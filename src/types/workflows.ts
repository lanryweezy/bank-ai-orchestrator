// For Workflow Definitions
export interface WorkflowStepTransition {
  to: string; // Name of the next step
  description?: string; // Optional description of the transition logic
  condition_type?: 'always' | 'on_output_value'; // Default to 'always' if not present
  // For 'on_output_value' conditions:
  field?: string; // Path to field in previous task's output_data_json (e.g., "reviewOutcome", "extractedData.amount")
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  value?: any; // Value to compare against for operators that require a value
}

// Define a recursive type for steps, as branches can contain steps
export interface BaseWorkflowStepDefinition {
  name: string;
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision' | 'parallel' | 'join' | 'end';
  description?: string; // Optional description for any step type
  agent_core_logic_identifier?: string; // For agent_execution
  assigned_role?: string; // For human_review, data_input, decision
  form_schema?: Record<string, any>; // For human_review, data_input, decision

  // For 'parallel' type
  branches?: WorkflowBranch[]; // Array of branches, each branch is an array of steps
  join_on?: string; // Name of the join step this parallel block's branches should eventually transition to

  // For 'join' type
  // No specific fields needed for 'join' itself, its significance is being a target for parallel branches.
  // It might have logic to merge outputs, defined by the engine.

  transitions?: WorkflowStepTransition[]; // Not applicable for 'parallel' type direct transitions, but its branches will have them. Not typically used by 'join' either.
  final_status?: 'approved' | 'rejected' | 'completed'; // For 'end' type
  default_input?: Record<string, any>;
  output_namespace?: string; // Optional: if a step's output should be namespaced in the context
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
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision';
  assigned_to_agent_id?: string | null;
  assigned_to_user_id?: string | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'requires_escalation';
  input_data_json?: Record<string, any> | null;
  output_data_json?: Record<string, any> | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}
