// Define the structure for an Agent Template fetched from the backend

export interface AgentTemplate {
  template_id: string;
  name: string;
  description?: string | null;
  core_logic_identifier: string;
  configurable_params_json_schema?: Record<string, any> | null; // JSON Schema object
  created_at: string;
  updated_at: string;
}

// May also need types for ConfiguredAgent later
export interface ConfiguredAgent {
  agent_id: string;
  template_id: string;
  template_name?: string; // Joined from agent_templates table
  user_id: string;
  bank_specific_name: string;
  configuration_json?: Record<string, any> | null;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  updated_at: string;
}
