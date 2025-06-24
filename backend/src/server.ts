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

import authRoutes from './api/auth/authRoutes'; // Import auth routes

// TODO: Add routes for users, accounts, transactions

// Mount auth routes
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  // Uncomment the line below to test DB connection when server starts
  // testConnection().catch(err => console.error("DB connection test failed on startup:", err));
});

export default app; // For potential testing or programmatic use
