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
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// API Documentation Route (Swagger UI)
// Make sure swaggerConfig includes schemas for AgentTemplateInput, ErrorResponse, AgentTemplate
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Simple route for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is healthy', timestamp: new Date().toISOString() });
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
import triggerAdminRoutes from './api/admin/triggerAdminRoutes';
import userAdminRoutes from './api/admin/userAdminRoutes'; // Import user admin routes

// Webhook Public Routes
import webhookRoutes from './api/webhookRoutes';


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
app.use('/api/admin/triggers', triggerAdminRoutes);
app.use('/api/admin/users', userAdminRoutes); // Mount user admin routes

// Mount Webhook Public Routes
app.use('/webhooks', webhookRoutes); // Using /webhooks as base path, not /api/webhooks


// Seed initial data (for development convenience)
import { seedInitialAgentTemplates } from './services/agentTemplateService';
import { seedInitialWorkflowDefinitions } from './services/workflowService';
import { initializeSchedulers as initializeWorkflowSchedulers } from './services/triggerService'; // Import scheduler initializer

const startServer = async () => {
  await seedInitialAgentTemplates();
  await seedInitialWorkflowDefinitions();
  await initializeWorkflowSchedulers(); // Initialize schedulers after seeding

  // testConnection().catch(err => console.error("DB connection test failed on startup:", err));
  // Start listening only after seeding (if any) is complete
  app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
  });
};

startServer().catch(error => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});

export default app; // For potential testing or programmatic use
