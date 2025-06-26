import swaggerJsdoc from 'swagger-jsdoc';
import { serverConfig } from './index'; // To get the port

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Agent & Workflow Automation Platform API',
      version: '1.0.0',
      description: 'API documentation for the AI Agent Management and Workflow Automation Platform for Banks.',
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
        UserInput: { // For user registration / login
          type: 'object',
          properties: {
            username: { type: 'string', example: 'bankuser' },
            email: { type: 'string', format: 'email', example: 'user@bank.com' },
            password: { type: 'string', format: 'password', example: 'strongpassword123' },
            full_name: { type: 'string', example: 'John Doe', nullable: true },
            role: { type: 'string', enum: ['bank_user', 'bank_admin', 'platform_admin'], example: 'bank_user', nullable: true }
          }
        },
        UserResponse: {
            type: 'object',
            properties: {
                user_id: { type: 'string', format: 'uuid' },
                username: { type: 'string' },
                email: { type: 'string', format: 'email' },
                full_name: { type: 'string', nullable: true },
                role: { type: 'string' }
            }
        },
        LoginResponse: {
            type: 'object',
            properties: {
                user: { '$ref': '#/components/schemas/UserResponse' },
                token: { type: 'string' }
            }
        },
        AgentTemplate: {
          type: 'object',
          properties: {
            template_id: { type: 'string', format: 'uuid', readOnly: true },
            name: { type: 'string', example: 'Loan Document Checker' },
            description: { type: 'string', nullable: true, example: 'Checks loan documents and basic rules.' },
            core_logic_identifier: { type: 'string', example: 'loanCheckerAgent_v1' },
            configurable_params_json_schema: { type: 'object', description: 'JSON schema for agent configuration parameters.', example: { type: "object", properties: { "threshold": { "type": "number" } } } },
            created_at: { type: 'string', format: 'date-time', readOnly: true },
            updated_at: { type: 'string', format: 'date-time', readOnly: true }
          },
          required: ['name', 'core_logic_identifier']
        },
        AgentTemplateInput: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Loan Document Checker' },
                description: { type: 'string', nullable: true, example: 'Checks loan documents and basic rules.' },
                core_logic_identifier: { type: 'string', example: 'loanCheckerAgent_v1' },
                configurable_params_json_schema: { type: 'object', description: 'JSON schema for agent configuration parameters.', example: { type: "object", properties: { "threshold": { "type": "number" } } } }
            },
            required: ['name', 'core_logic_identifier']
        },
        ConfiguredAgent: {
          type: 'object',
          properties: {
            agent_id: { type: 'string', format: 'uuid', readOnly: true },
            template_id: { type: 'string', format: 'uuid' },
            template_name: { type: 'string', readOnly: true, description: "Name of the template used (joined)"},
            user_id: { type: 'string', format: 'uuid', readOnly: true },
            bank_specific_name: { type: 'string', example: 'My Bank Loan Checker' },
            configuration_json: { type: 'object', description: 'Bank-specific configuration values for this agent instance.', example: { threshold: 0.75 } },
            status: { type: 'string', enum: ['active', 'inactive', 'error'], default: 'active' },
            created_at: { type: 'string', format: 'date-time', readOnly: true },
            updated_at: { type: 'string', format: 'date-time', readOnly: true }
          },
          required: ['template_id', 'bank_specific_name']
        },
        ConfiguredAgentInput: {
            type: 'object',
            properties: {
                template_id: { type: 'string', format: 'uuid' },
                bank_specific_name: { type: 'string', example: 'My Bank Loan Checker' },
                configuration_json: { type: 'object', description: 'Bank-specific configuration values for this agent instance.', example: { threshold: 0.75 } },
                status: { type: 'string', enum: ['active', 'inactive', 'error'], nullable: true },
            },
            required: ['template_id', 'bank_specific_name']
        },
        WorkflowDefinition: {
            type: 'object',
            properties: {
                workflow_id: { type: 'string', format: 'uuid', readOnly: true },
                name: { type: 'string', example: 'Loan Application Processing' },
                description: { type: 'string', nullable: true },
                definition_json: { type: 'object', description: 'JSON defining workflow steps and logic.' },
                version: { type: 'integer', default: 1 },
                is_active: { type: 'boolean', default: true },
                created_at: { type: 'string', format: 'date-time', readOnly: true },
                updated_at: { type: 'string', format: 'date-time', readOnly: true }
            },
            required: ['name', 'definition_json']
        },
        WorkflowDefinitionInput: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Loan Application Processing' },
                description: { type: 'string', nullable: true },
                definition_json: { type: 'object', description: 'JSON defining workflow steps and logic.' },
                version: { type: 'integer', nullable: true },
                is_active: { type: 'boolean', nullable: true },
            },
            required: ['name', 'definition_json']
        },
        WorkflowRun: {
            type: 'object',
            properties: {
                run_id: { type: 'string', format: 'uuid', readOnly: true },
                workflow_id: { type: 'string', format: 'uuid' },
                workflow_name: { type: 'string', readOnly: true },
                workflow_version: { type: 'integer', readOnly: true },
                triggering_user_id: { type: 'string', format: 'uuid', nullable: true },
                triggering_data_json: { type: 'object', nullable: true },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] },
                current_step_name: { type: 'string', nullable: true },
                start_time: { type: 'string', format: 'date-time' },
                end_time: { type: 'string', format: 'date-time', nullable: true },
                results_json: { type: 'object', nullable: true },
                created_at: { type: 'string', format: 'date-time', readOnly: true },
                updated_at: { type: 'string', format: 'date-time', readOnly: true }
            }
        },
        StartWorkflowRunInput: {
            type: 'object',
            properties: {
                triggering_data_json: { type: 'object', nullable: true, example: { applicationId: "APP123" } },
                workflow_name: { type: 'string', nullable: true, description: "Used if starting by name instead of ID."},
                workflow_version: { type: 'integer', nullable: true, description: "Used with workflow_name."}
            }
        },
        Task: {
            type: 'object',
            properties: {
                task_id: { type: 'string', format: 'uuid', readOnly: true },
                run_id: { type: 'string', format: 'uuid' },
                workflow_id: { type: 'string', format: 'uuid', readOnly: true, description: "Joined data"},
                workflow_name: { type: 'string', readOnly: true, description: "Joined data"},
                step_name_in_workflow: { type: 'string' },
                type: { type: 'string', enum: ['agent_execution', 'human_review', 'data_input', 'decision'] },
                assigned_to_agent_id: { type: 'string', format: 'uuid', nullable: true },
                assigned_to_user_id: { type: 'string', format: 'uuid', nullable: true },
                status: { type: 'string', enum: ['pending', 'assigned', 'in_progress', 'completed', 'failed', 'skipped', 'requires_escalation'] },
                input_data_json: { type: 'object', nullable: true },
                output_data_json: { type: 'object', nullable: true },
                due_date: { type: 'string', format: 'date-time', nullable: true },
                created_at: { type: 'string', format: 'date-time', readOnly: true },
                updated_at: { type: 'string', format: 'date-time', readOnly: true }
            }
        },
        CompleteTaskInput: {
            type: 'object',
            properties: {
                output_data_json: { type: 'object', nullable: true, example: { reviewOutcome: "approved" } }
            }
        }
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
