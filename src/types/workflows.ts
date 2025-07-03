// For Workflow Definitions (matches Zod schemas in workflowService.ts)
export interface SingleConditionType {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'exists' | 'not_exists' | 'regex';
  value?: any;
}

export interface ConditionGroupType {
  logical_operator: 'AND' | 'OR';
  conditions: Array<SingleConditionType | ConditionGroupType>; // Recursive
}

export interface WorkflowStepTransition {
  to: string;
  description?: string;
  condition_type?: 'always' | 'conditional';
  condition_group?: ConditionGroupType;
}

// For error handling config within a step
export interface RetryPolicyType {
  max_attempts?: number;
  delay_seconds?: number;
  backoff_strategy?: 'fixed' | 'exponential';
  jitter?: boolean;
}

export interface OnFailureActionType {
  action?: 'fail_workflow' | 'transition_to_step' | 'continue_with_error' | 'manual_intervention';
  next_step?: string;
  error_output_namespace?: string;
}

export interface ErrorHandlingType {
  retry_policy?: RetryPolicyType;
  on_failure?: OnFailureActionType;
}

// For human task specific definitions
export interface HumanTaskEscalationPolicyType {
  after_minutes: number;
  action: 'reassign_to_role' | 'notify_manager_role' | 'custom_event';
  target_role?: string;
  custom_event_name?: string;
}

// For external_api_call step specific definitions
export interface ExternalApiCallStepConfigType {
  url_template: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers_template?: Record<string, string>;
  query_params_template?: Record<string, string>;
  body_template?: any;
  timeout_seconds?: number;
  success_criteria?: {
    status_codes?: number[];
  };
}


// Define a recursive type for steps, as branches can contain steps
export interface BaseWorkflowStepDefinition {
  name: string;
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision' | 'parallel' | 'join' | 'end' | 'sub_workflow' | 'external_api_call';
  description?: string;

  // Type-specific configurations
  agent_core_logic_identifier?: string; // For agent_execution
  external_api_call_config?: ExternalApiCallStepConfigType; // For external_api_call

  // For human_review, data_input, decision steps
  assigned_role?: string;
  form_schema?: Record<string, any>;
  deadline_minutes?: number;
  escalation_policy?: HumanTaskEscalationPolicyType;

  // For 'parallel' type
  branches?: WorkflowBranch[];
  join_on?: string;

  // For 'sub_workflow' type
  sub_workflow_name?: string;
  sub_workflow_version?: number;
  input_mapping?: Record<string, string>;

  transitions?: WorkflowStepTransition[];
  final_status?: 'approved' | 'rejected' | 'completed';
  default_input?: Record<string, any>;
  output_namespace?: string;
  error_handling?: ErrorHandlingType; // Common error handling
}

// A branch is essentially a list of steps
export interface WorkflowBranch {
  name: string; // Name for this branch (e.g., "creditCheckBranch", "documentVerificationBranch")
  start_step: string; // Name of the first step in this branch
  steps: BaseWorkflowStepDefinition[];
  // Each branch implicitly transitions to the 'join_on' step specified in the parent 'parallel' step.
  // Or, the last step in each branch explicitly transitions to the 'join' step.
}


// Make WorkflowStepDefinition use the Base type, but without self-reference issues for simple arrays
export type WorkflowStepDefinition = BaseWorkflowStepDefinition;


export interface WorkflowDefinition {
  workflow_id: string;
  name: string;
  description?: string | null;
  definition_json: { // This is the actual JSON structure stored
    name?: string; // May duplicate workflow.name
    description?: string; // May duplicate workflow.description
    initialContextSchema?: Record<string, any>; // JSON Schema for triggering_data_json
    steps: WorkflowStepDefinition[];
    start_step: string;
  };
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// For Task Comments
export interface TaskComment {
  comment_id: string;
  task_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
  user?: { // User details are joined from the backend service
    username: string;
    full_name?: string | null;
  };
}


// For Workflow Runs
export interface WorkflowRun {
  run_id: string;
  workflow_id: string;
  workflow_name?: string; // Joined from workflows table
  workflow_version?: number; // Joined from workflows table
  triggering_user_id?: string | null;
  triggering_data_json?: Record<string, any> | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  current_step_name?: string | null;
  start_time: string;
  end_time?: string | null;
  results_json?: Record<string, any> | null;
  active_parallel_branches?: Record<string, any> | null; // Added to match DB schema
  created_at: string;
  updated_at: string;
}

// For Tasks
export interface Task {
  task_id: string;
  run_id: string;
  workflow_id?: string; // Joined from workflow_runs -> workflows
  workflow_name?: string; // Joined
  step_name_in_workflow: string;
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision' | 'sub_workflow';
  assigned_to_agent_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_role?: string | null; // Added
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'requires_escalation'; // Consider 'delegated', 'escalated'
  input_data_json?: Record<string, any> | null;
  output_data_json?: Record<string, any> | null;
  // due_date?: string | null; // Original field, can be superseded by deadline_at
  sub_workflow_run_id?: string | null;
  created_at: string;
  updated_at: string;

  // New fields for enhanced human task management
  deadline_at?: string | null; // ISO datetime string
  escalation_policy_json?: HumanTaskEscalationPolicyType | null; // Parsed from JSONB
  is_delegated?: boolean;
  delegated_by_user_id?: string | null;
  retry_count?: number;
}
