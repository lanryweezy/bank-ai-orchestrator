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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // Added

// Simple route for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is healthy', timestamp: new Date().toISOString() });
});

import authRoutes from './api/auth/authRoutes';
import agentTemplateAdminRoutes from './api/admin/agentTemplateAdminRoutes';
import agentTemplateRoutes from './api/agentTemplates/agentTemplateRoutes';
import configuredAgentRoutes from './api/configuredAgents/configuredAgentRoutes';
import workflowAdminRoutes from './api/admin/workflowAdminRoutes';
import workflowRoutes from './api/workflows/workflowRoutes';
import workflowRunRoutes from './api/workflowRuns/workflowRunRoutes';
import taskRoutes from './api/tasks/taskRoutes';

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount Agent Management Routes
app.use('/api/admin/agent-templates', agentTemplateAdminRoutes); // Admin routes for templates
app.use('/api/agent-templates', agentTemplateRoutes); // Public/user routes for templates
app.use('/api/configured-agents', configuredAgentRoutes); // User routes for their configured agents

// Mount Workflow Engine Routes
app.use('/api/admin/workflows', workflowAdminRoutes); // Admin routes for workflow definitions
app.use('/api/workflows', workflowRoutes); // User routes for workflow definitions and starting runs
app.use('/api/workflow-runs', workflowRunRoutes); // User routes for viewing workflow runs
app.use('/api/tasks', taskRoutes); // User routes for managing their tasks

// Seed initial data (for development convenience)
import { seedInitialAgentTemplates } from './services/agentTemplateService';
import { seedInitialWorkflowDefinitions } from './services/workflowService';

const startServer = async () => {
  await seedInitialAgentTemplates();
  await seedInitialWorkflowDefinitions();

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
