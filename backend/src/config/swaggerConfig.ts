import swaggerJsdoc from 'swagger-jsdoc';
import { serverConfig } from './index'; // To get the port

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Core Banking API',
      version: '1.0.0',
      description: 'API documentation for the Core Banking System',
      contact: {
        name: 'API Support',
        url: 'http://www.example.com/support', // Replace with actual support URL
        email: 'support@example.com', // Replace with actual support email
      },
    },
    servers: [
      {
        url: `http://localhost:${serverConfig.port}/api`, // Adjust if your API base path is different
        description: 'Development server',
      },
      // Add more servers (e.g., staging, production) as needed
      // {
      //   url: `https://api.yourbank.com/v1`,
      //   description: 'Production server',
      // }
    ],
    components: {
      schemas: {
        // General error response
        ErrorResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'A human-readable error message.',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                   // Depending on Zod or other validation error structure
                  path: { type: 'array', items: { type: 'string' } },
                  message: { type: 'string' }
                }
              },
              nullable: true,
              description: 'Optional array of specific validation errors.'
            }
          },
          required: ['message']
        },
        // You can define common request/response schemas here and reference them using $ref
        // Example:
        // User: {
        //   type: 'object',
        //   properties: {
        //     user_id: { type: 'string', format: 'uuid' },
        //     username: { type: 'string' },
        //     email: { type: 'string', format: 'email' },
        //     role: { type: 'string' },
        //     full_name: { type: 'string', nullable: true }
        //   }
        // }
      },
      securitySchemes: { // Define security schemes (e.g., Bearer token for JWT)
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    // security: [ // Global security requirement, can be overridden at operation level
    //   {
    //     bearerAuth: [],
    //   },
    // ],
  },
  // Path to the API docs (JSDoc comments)
  apis: ['./backend/src/api/**/*.ts'], // Glob pattern to find API route files
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
