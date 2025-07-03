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
        url: 'https://lovable.dev',
        email: 'support@lovable.dev',
      },
    },
    servers: [
      {
        url: `http://localhost:${serverConfig.port}/api`,
        description: 'Development server (backend)',
      },
      // Example for a deployed server:
      // {
      //   url: `https://your-deployed-app-url.com/api`,
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
                definition_json: {
                  type: 'object',
                  description: 'JSON defining workflow steps, transitions, conditions, error handling, etc.',
                  example: {
                    name: "Sample Workflow with New Features",
                    description: "Illustrates new conditional logic, error handling, and step types.",
                    start_step: "check_input_data",
                    steps: [
                      {
                        name: "check_input_data",
                        type: "decision",
                        transitions: [
                          {
                            to: "call_external_api",
                            condition_type: "conditional",
                            condition_group: {
                              logical_operator: "AND",
                              conditions: [
                                { field: "context.amount", operator: ">", value: 1000 },
                                { field: "context.type", operator: "==", value: "priority" }
                              ]
                            }
                          },
                          { to: "manual_review_low_amount", condition_type: "always" }
                        ],
                        error_handling: {
                          on_failure: { action: "fail_workflow" }
                        }
                      },
                      {
                        name: "call_external_api",
                        type: "external_api_call",
                        external_api_call_config: {
                          url_template: "https://api.example.com/process/{{context.id}}",
                          method: "POST",
                          body_template: { data: "{{context.some_data}}", amount: "{{context.amount}}" },
                          headers_template: { "X-API-Key": "{{secrets.MY_SERVICE_KEY}}" }
                        },
                        error_handling: {
                          retry_policy: { max_attempts: 3, delay_seconds: 5 },
                          on_failure: { action: "transition_to_step", next_step: "api_failure_handler" }
                        },
                        transitions: [{to: "final_processing", condition_type: "always"}]
                      },
                      { name: "manual_review_low_amount", type: "human_review", assigned_role: "clerk", deadline_minutes: 60, transitions: [{to: "final_processing", condition_type: "always"}]},
                      { name: "api_failure_handler", type: "human_review", assigned_role: "support_lead", description: "Handle API call failure."},
                      { name: "final_processing", type: "agent_execution", agent_core_logic_identifier: "final_processor_v1"},
                      { name: "end_workflow", type: "end", final_status: "completed"}
                    ]
                  }
                },
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
                definition_json: {
                  type: 'object',
                  description: 'JSON defining workflow steps and logic. See WorkflowDefinition for a detailed example.',
                  example: {
                    name: "Loan Application Initial",
                    start_step: "intake",
                    steps: [{ name: "intake", type: "human_review", assigned_role: "clerk"}]
                  }
                },
                version: { type: 'integer', nullable: true, description: "Version number for the workflow. Auto-managed for new versions of existing names." },
                is_active: { type: 'boolean', nullable: true, description: "Whether this workflow version is active." },
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
        },
        TaskCommentInput: {
            type: 'object',
            properties: {
                comment_text: { type: 'string', description: "The content of the comment.", example: "This task needs further clarification." }
            },
            required: ["comment_text"]
        },
        TaskComment: {
            type: 'object',
            properties: {
                comment_id: { type: 'string', format: 'uuid', readOnly: true },
                task_id: { type: 'string', format: 'uuid', readOnly: true },
                user_id: { type: 'string', format: 'uuid', readOnly: true },
                comment_text: { type: 'string' },
                created_at: { type: 'string', format: 'date-time', readOnly: true },
                updated_at: { type: 'string', format: 'date-time', readOnly: true },
                // User details are joined in the service, so include them here
                user: {
                    type: 'object',
                    properties: {
                        username: { type: 'string' },
                        full_name: { type: 'string', nullable: true }
                    }
                }
            }
        },
        // Workflow Triggers
        ScheduledTriggerConfig: {
            type: 'object',
            properties: {
                cron_string: { type: 'string', example: '0 0 * * *' },
                timezone: { type: 'string', example: 'America/New_York', default: 'UTC' },
                default_payload: { type: 'object', nullable: true, example: { "source": "cron" } }
            },
            required: ['cron_string']
        },
        WebhookTriggerSecurityConfig: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['none', 'hmac_sha256', 'bearer_token'], default: 'none'},
                secret_env_var: { type: 'string', description: "Name of ENV var holding the secret/token."},
                header_name: { type: 'string', description: "HTTP header name for signature/token."}
            }
        },
        WebhookTriggerConfig: {
            type: 'object',
            properties: {
                path_identifier: { type: 'string', example: 'unique-hook-path' },
                method: { type: 'string', enum: ['POST', 'GET', 'PUT'], default: 'POST' },
                security: { '$ref': '#/components/schemas/WebhookTriggerSecurityConfig' },
                payload_mapping_jq: { type: 'string', default: '.', example: '.body' }
            },
            required: ['path_identifier']
        },
        TriggerInput: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Nightly Batch Workflow Trigger' },
                description: { type: 'string', nullable: true },
                workflow_id: { type: 'string', format: 'uuid', description: "ID of the specific workflow version to run." },
                type: { type: 'string', enum: ['scheduled', 'webhook', 'event_bus'] },
                configuration_json: {
                    oneOf: [
                        { '$ref': '#/components/schemas/ScheduledTriggerConfig' },
                        { '$ref': '#/components/schemas/WebhookTriggerConfig' },
                        { type: 'object', description: "Configuration for other types like event_bus" }
                    ],
                    description: "Configuration specific to the trigger type."
                },
                is_enabled: { type: 'boolean', default: true }
            },
            required: ['name', 'workflow_id', 'type', 'configuration_json']
        },
        WorkflowTrigger: {
            allOf: [ { '$ref': '#/components/schemas/TriggerInput' } ],
            type: 'object',
            properties: {
                trigger_id: { type: 'string', format: 'uuid', readOnly: true },
                created_by_user_id: { type: 'string', format: 'uuid', readOnly: true },
                last_triggered_at: { type: 'string', format: 'date-time', nullable: true, readOnly: true },
                created_at: { type: 'string', format: 'date-time', readOnly: true },
                updated_at: { type: 'string', format: 'date-time', readOnly: true }
            }
        },
        // Task Delegation
        DelegateTaskBody: {
            type: 'object',
            properties: {
                targetUserId: { type: 'string', format: 'uuid', description: "User ID of the user to delegate the task to."}
            },
            required: ['targetUserId']
        }
      },
      securitySchemes: { // Define security schemes (e.g., Bearer token for JWT)
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      parameters: { // Reusable parameters
        TaskIdPath: {
          name: 'taskId',
          in: 'path',
          required: true,
          description: 'ID of the task.',
          schema: { type: 'string', format: 'uuid' }
        },
        TriggerIdPath: {
          name: 'triggerId',
          in: 'path',
          required: true,
          description: 'ID of the trigger.',
          schema: { type: 'string', format: 'uuid' }
        },
        WorkflowIdPath: { // Already implicitly defined in some routes, but good to have reusable
          name: 'workflowId',
          in: 'path',
          required: true,
          description: 'ID of the workflow definition or instance.',
          schema: { type: 'string', format: 'uuid' }
        }
      },
      responses: { // Reusable responses
        NotFound: { description: 'The requested resource was not found.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        BadRequest: { description: 'Invalid request payload or parameters.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        Unauthorized: { description: 'Unauthorized - Authentication token is missing or invalid.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        Forbidden: { description: 'Forbidden - User does not have permission to perform this action.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        Conflict: { description: 'Conflict - The request could not be completed due to a conflict with the current state of the resource.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        InternalServerError: { description: 'Internal Server Error.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
      }
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
