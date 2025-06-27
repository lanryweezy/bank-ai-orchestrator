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

export interface WorkflowStepDefinition {
  name: string;
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision' | 'end';
  agent_core_logic_identifier?: string; // If type is agent_execution
  // configured_agent_id?: string; // Alternative: directly link to a pre-configured agent
  assigned_role?: string; // For human tasks, e.g. 'loan_officer'
  form_schema?: Record<string, any>; // JSON schema for human task input/output
  transitions: WorkflowStepTransition[];
  final_status?: 'approved' | 'rejected' | 'completed'; // If type is 'end'
  default_input?: Record<string, any>;
}

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
