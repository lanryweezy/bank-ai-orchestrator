import swaggerJsdoc from 'swagger-jsdoc';
import { serverConfig } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Agent & Workflow Automation Platform API',
      version: '1.0.0',
      description: 'API documentation for the AI Agent Management and Workflow Automation Platform for Banks.',
      contact: { name: 'API Support', url: 'https://lovable.dev', email: 'support@lovable.dev' },
    },
    servers: [ { url: `http://localhost:${serverConfig.port}/api`, description: 'Development server (backend)' } ],
    components: {
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'A human-readable error message.' },
            errors: {
              type: 'array',
              items: { type: 'object', properties: { path: { type: 'array', items: { type: 'string' } }, message: { type: 'string' }}},
              nullable: true, description: 'Optional array of specific validation errors.'
            }
          },
          required: ['message']
        },
        UserInput: {
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
                user_id: { type: 'string', format: 'uuid' }, username: { type: 'string' },
                email: { type: 'string', format: 'email' }, full_name: { type: 'string', nullable: true }, role: { type: 'string' }
            }
        },
        LoginResponse: {
            type: 'object',
            properties: { user: { '$ref': '#/components/schemas/UserResponse' }, token: { type: 'string' } }
        },
        AgentTemplate: {
          type: 'object',
          properties: {
            template_id: { type: 'string', format: 'uuid', readOnly: true }, name: { type: 'string', example: 'Loan Document Checker' },
            description: { type: 'string', nullable: true, example: 'Checks loan documents and basic rules.' },
            core_logic_identifier: { type: 'string', example: 'loanCheckerAgent_v1' },
            configurable_params_json_schema: { type: 'object', description: 'JSON schema for agent configuration parameters.', example: { type: "object", properties: { "threshold": { "type": "number" } } } },
            created_at: { type: 'string', format: 'date-time', readOnly: true }, updated_at: { type: 'string', format: 'date-time', readOnly: true }
          },
          required: ['name', 'core_logic_identifier']
        },
        AgentTemplateInput: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Loan Document Checker' }, description: { type: 'string', nullable: true, example: 'Checks loan documents and basic rules.' },
                core_logic_identifier: { type: 'string', example: 'loanCheckerAgent_v1' },
                configurable_params_json_schema: { type: 'object', description: 'JSON schema for agent configuration parameters.', example: { type: "object", properties: { "threshold": { "type": "number" } } } }
            },
            required: ['name', 'core_logic_identifier']
        },
        ConfiguredAgent: {
          type: 'object',
          properties: {
            agent_id: { type: 'string', format: 'uuid', readOnly: true }, template_id: { type: 'string', format: 'uuid' },
            template_name: { type: 'string', readOnly: true, description: "Name of the template used (joined)"},
            user_id: { type: 'string', format: 'uuid', readOnly: true }, bank_specific_name: { type: 'string', example: 'My Bank Loan Checker' },
            configuration_json: { type: 'object', description: 'Bank-specific configuration values for this agent instance.', example: { threshold: 0.75 } },
            status: { type: 'string', enum: ['active', 'inactive', 'error'], default: 'active' },
            created_at: { type: 'string', format: 'date-time', readOnly: true }, updated_at: { type: 'string', format: 'date-time', readOnly: true }
          },
          required: ['template_id', 'bank_specific_name']
        },
        ConfiguredAgentInput: {
            type: 'object',
            properties: {
                template_id: { type: 'string', format: 'uuid' }, bank_specific_name: { type: 'string', example: 'My Bank Loan Checker' },
                configuration_json: { type: 'object', description: 'Bank-specific configuration values for this agent instance.', example: { threshold: 0.75 } },
                status: { type: 'string', enum: ['active', 'inactive', 'error'], nullable: true },
            },
            required: ['template_id', 'bank_specific_name']
        },
        WorkflowDefinition: { // Uses $ref for definition_json now
            type: 'object',
            properties: {
                workflow_id: { type: 'string', format: 'uuid', readOnly: true }, name: { type: 'string', example: 'Loan Application Processing' },
                description: { type: 'string', nullable: true }, definition_json: { '$ref': '#/components/schemas/WorkflowDefinitionJson' },
                version: { type: 'integer', default: 1 }, is_active: { type: 'boolean', default: true },
                created_at: { type: 'string', format: 'date-time', readOnly: true }, updated_at: { type: 'string', format: 'date-time', readOnly: true }
            },
            required: ['name', 'definition_json']
        },
        WorkflowDefinitionInput: { // Uses $ref for definition_json now
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Loan Application Processing' }, description: { type: 'string', nullable: true },
                definition_json: { '$ref': '#/components/schemas/WorkflowDefinitionJson' },
                version: { type: 'integer', nullable: true, description: "Version number for the workflow." },
                is_active: { type: 'boolean', nullable: true, description: "Whether this workflow version is active." },
            },
            required: ['name', 'definition_json']
        },
        // START: Detailed Schemas for WorkflowDefinitionJson Content
        WorkflowDefinitionJson: {
            type: 'object',
            description: "The core JSON structure defining a workflow's logic, steps, and transitions.",
            properties: {
                name: { type: 'string', nullable: true, description: "Optional name within the JSON." },
                description: { type: 'string', nullable: true },
                initialContextSchema: { type: 'object', nullable: true, description: "JSON schema for expected triggering_data_json." },
                start_step: { type: 'string', description: "Name of the first step to execute." },
                steps: { type: 'array', items: { '$ref': '#/components/schemas/WorkflowStepDefinitionSwagger' } }
            },
            required: ['start_step', 'steps'],
            example: { // Keep the example here for the overall structure
                name: "Sample Workflow with New Features", description: "Illustrates new conditional logic, error handling, and step types.",
                start_step: "check_input_data",
                steps: [ /* array of step objects, see WorkflowStepDefinitionSwagger example */ ]
            }
        },
        WorkflowStepDefinitionSwagger: {
            type: 'object', description: "Configuration for a single step.",
            properties: {
                name: { type: 'string' }, type: { type: 'string', enum: ['agent_execution', 'human_review', 'data_input', 'decision', 'parallel', 'join', 'end', 'sub_workflow', 'external_api_call'] },
                description: { type: 'string', nullable: true },
                agent_core_logic_identifier: { type: 'string', nullable: true },
                external_api_call_config: { '$ref': '#/components/schemas/ExternalApiCallConfigSwagger', nullable: true },
                assigned_role: { type: 'string', nullable: true }, form_schema: { type: 'object', nullable: true },
                deadline_minutes: { type: 'integer', nullable: true }, escalation_policy: { '$ref': '#/components/schemas/HumanTaskEscalationPolicySwagger', nullable: true},
                branches: { type: 'array', items: { '$ref': '#/components/schemas/WorkflowBranchSwagger'}, nullable: true}, // Recursive structure
                join_on: { type: 'string', nullable: true},
                sub_workflow_name: { type: 'string', nullable: true}, sub_workflow_version: { type: 'integer', nullable: true},
                input_mapping: { type: 'object', additionalProperties: {type: 'string'}, nullable: true},
                transitions: { type: 'array', items: { '$ref': '#/components/schemas/WorkflowStepTransitionSwagger' }, nullable: true },
                final_status: { type: 'string', enum: ['approved', 'rejected', 'completed'], nullable: true },
                default_input: { type: 'object', nullable: true}, output_namespace: { type: 'string', nullable: true},
                error_handling: { '$ref': '#/components/schemas/ErrorHandlingSwagger', nullable: true }
            },
            required: ['name', 'type'],
            example: { name: "check_input_data", type: "decision", transitions: [{to: "next_step", condition_type: "always"}] }
        },
        WorkflowBranchSwagger: { // Simplified for Swagger, actual can be recursive
            type: 'object', properties: { name: {type: 'string'}, start_step: {type: 'string'}, steps: { type: 'array', items: {'$ref': '#/components/schemas/WorkflowStepDefinitionSwagger'}}}
        },
        WorkflowStepTransitionSwagger: {
            type: 'object', properties: {
                to: { type: 'string' }, description: { type: 'string', nullable: true },
                condition_type: { type: 'string', enum: ['always', 'conditional'], default: 'conditional' },
                condition_group: { '$ref': '#/components/schemas/ConditionGroupSwagger', nullable: true }
            }, required: ['to']
        },
        ConditionGroupSwagger: {
            type: 'object', properties: {
                logical_operator: { type: 'string', enum: ['AND', 'OR'] },
                conditions: { type: 'array', items: { oneOf: [ { '$ref': '#/components/schemas/SingleConditionSwagger' }, { '$ref': '#/components/schemas/ConditionGroupSwagger' } ] } }
            }, required: ['logical_operator', 'conditions']
        },
        SingleConditionSwagger: {
            type: 'object', properties: {
                field: { type: 'string' }, operator: { type: 'string', enum: ['==', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains', 'exists', 'not_exists', 'regex'] },
                value: { type: 'string', nullable: true, description: "Can be string, number, boolean. For 'regex', it's the pattern."}
            }, required: ['field', 'operator']
        },
        ErrorHandlingSwagger: {
            type: 'object', properties: { retry_policy: { '$ref': '#/components/schemas/RetryPolicySwagger', nullable: true }, on_failure: { '$ref': '#/components/schemas/OnFailureActionSwagger' } }
        },
        RetryPolicySwagger: {
            type: 'object', properties: {
                max_attempts: { type: 'integer', default: 1 }, delay_seconds: { type: 'integer', nullable: true },
                backoff_strategy: { type: 'string', enum: ['fixed', 'exponential'], default: 'fixed' }, jitter: { type: 'boolean', default: false }
            }
        },
        OnFailureActionSwagger: {
            type: 'object', properties: {
                action: { type: 'string', enum: ['fail_workflow', 'transition_to_step', 'continue_with_error', 'manual_intervention'], default: 'fail_workflow' },
                next_step: { type: 'string', nullable: true }, error_output_namespace: { type: 'string', nullable: true }
            }
        },
        ExternalApiCallConfigSwagger: {
            type: 'object', properties: {
                url_template: { type: 'string' }, method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
                headers_template: { type: 'object', additionalProperties: {type: 'string'}, nullable: true }, query_params_template: { type: 'object', additionalProperties: {type: 'string'}, nullable: true },
                body_template: { type: 'object', nullable: true, description: "Can be any JSON or string." }, timeout_seconds: { type: 'integer', default: 30 },
                success_criteria: { type: 'object', properties: { status_codes: { type: 'array', items: {type: 'integer'}, default: [200,201,202,204] } } }
            }, required: ['url_template']
        },
        HumanTaskEscalationPolicySwagger: {
            type: 'object', properties: {
                after_minutes: { type: 'integer'}, action: { type: 'string', enum: ['reassign_to_role', 'notify_manager_role', 'custom_event']},
                target_role: { type: 'string', nullable: true}, custom_event_name: { type: 'string', nullable: true}
            }, required: ['after_minutes', 'action']
        },
        // END: Detailed Schemas
        WorkflowRun: { /* ... existing ... */ }, StartWorkflowRunInput: { /* ... existing ... */ }, Task: { /* ... existing ... */ },
        CompleteTaskInput: { /* ... existing ... */ }, TaskCommentInput: { /* ... existing ... */ }, TaskComment: { /* ... existing ... */ },
        ScheduledTriggerConfig: { /* ... existing ... */ }, WebhookTriggerSecurityConfig: { /* ... existing ... */ }, WebhookTriggerConfig: { /* ... existing ... */ },
        TriggerInput: { /* ... existing ... */ }, WorkflowTrigger: { /* ... existing ... */ }, DelegateTaskBody: { /* ... existing ... */ }
      },
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }},
      parameters: {
        TaskIdPath: { name: 'taskId', in: 'path', required: true, description: 'ID of the task.', schema: { type: 'string', format: 'uuid' } },
        TriggerIdPath: { name: 'triggerId', in: 'path', required: true, description: 'ID of the trigger.', schema: { type: 'string', format: 'uuid' } },
        WorkflowIdPath: { name: 'workflowId', in: 'path', required: true, description: 'ID of the workflow.', schema: { type: 'string', format: 'uuid' } }
      },
      responses: {
        NotFound: { description: 'Resource not found.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        BadRequest: { description: 'Invalid request.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        Unauthorized: { description: 'Unauthorized.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        Forbidden: { description: 'Forbidden.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        Conflict: { description: 'Conflict.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
        InternalServerError: { description: 'Internal Server Error.', content: {'application/json': {schema: {'$ref': '#/components/schemas/ErrorResponse'}}} },
      }
    },
  },
  apis: ['./backend/src/api/**/*.ts'],
};
const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
