import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; // Added
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swaggerConfig';
import { serverConfig } from './config';
// import { testConnection } from './config/db'; // Uncomment to test DB connection on startup

const app = express();
const PORT = serverConfig.port;

// Middleware
app.use(helmet()); // Basic security headers

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://*.vercel.app']
    : ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // Enable CORS with configuration
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// API Documentation Route (Swagger UI)
// Make sure swaggerConfig includes schemas for AgentTemplateInput, ErrorResponse, AgentTemplate
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check route with database connection test
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await query('SELECT NOW()');
    
    res.json({ 
      status: 'Backend is healthy',
      database: 'Railway PostgreSQL connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Backend unhealthy',
      database: 'Railway PostgreSQL connection failed', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Import Routes
import authRoutes from './api/auth/authRoutes';
import agentTemplateUserRoutes from './api/agentTemplates/agentTemplateRoutes'; // Renamed for clarity
import configuredAgentRoutes from './api/configuredAgents/configuredAgentRoutes';
import workflowUserRoutes from './api/workflows/workflowRoutes'; // Renamed for clarity
import workflowRunRoutes from './api/workflowRuns/workflowRunRoutes';
import taskRoutes from './api/tasks/taskRoutes';

// Admin Routes
import agentTemplateAdminRoutes from './api/admin/agentTemplateAdminRoutes';
import workflowAdminRoutes from './api/admin/workflowAdminRoutes';

// Core Banking Routes
import accountRoutes from './api/corebanking/accountRoutes';
import customerRoutes from './api/corebanking/customerRoutes';
import complianceRoutes from './api/corebanking/complianceRoutes';


// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount User-Facing Routes
app.use('/api/agent-templates', agentTemplateUserRoutes);
app.use('/api/configured-agents', configuredAgentRoutes);
app.use('/api/workflows', workflowUserRoutes);
app.use('/api/workflow-runs', workflowRunRoutes);
app.use('/api/tasks', taskRoutes);

// Mount Admin Routes (ensure these are appropriately protected by middleware inside the route files)
app.use('/api/admin/agent-templates', agentTemplateAdminRoutes);
app.use('/api/admin/workflows', workflowAdminRoutes);

// Mount Core Banking Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/compliance', complianceRoutes);


// Seed initial data (for development convenience)
import { seedInitialAgentTemplates } from './services/agentTemplateService';
import { seedInitialWorkflowDefinitions } from './services/workflowService';
import { seedBankingWorkflowTemplates } from './services/bankingWorkflowTemplates';
import { query } from './config/db';
import { testRailwayConnection, initializeRailwayDatabase } from './utils/testDatabase';

const startServer = async () => {
  try {
    console.log('🚀 Starting banking application server...');
    
    // Only seed data in development or when explicitly requested
    if (process.env.NODE_ENV !== 'production' || process.env.SEED_DATA === 'true') {
      console.log('🌱 Seeding initial data...');
      await seedInitialAgentTemplates();
      await seedInitialWorkflowDefinitions();
      await seedBankingWorkflowTemplates(query);
      console.log('✅ Data seeding completed');
    }

    // Test Railway database connection
    const dbTest = await testRailwayConnection();
    if (!dbTest.success) {
      console.error('❌ Railway database connection failed. Please check your DATABASE_URL.');
      if (process.env.NODE_ENV !== 'production') {
        return;
      }
    }
    
    // Initialize database schema if needed
    await initializeRailwayDatabase();

    // Start server only if not running in Vercel (serverless)
    if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`🏦 Banking server running on http://localhost:${PORT}`);
        console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

// Initialize server
startServer();

export default app; // For potential testing or programmatic use
