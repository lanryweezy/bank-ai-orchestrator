import { query } from '../config/db';
import { z } from 'zod';
import {
    LOAN_CHECKER_AGENT_LOGIC_ID,
    loanCheckerAgentConfigSchema,
    loanCheckerAgentInputSchema,
    executeLoanCheckerAgentLogic
} from './agentLogic/loanCheckerAgent';
import {
    DATA_EXTRACTOR_AGENT_LOGIC_ID,
    dataExtractorAgentConfigSchema,
    dataExtractorAgentInputSchema,
    executeDataExtractorAgentLogic
} from './agentLogic/dataExtractorAgent';
import { getAgentTemplateById } from './agentTemplateService'; // To fetch template details

// Zod schema for ConfiguredAgent creation and update
export const configuredAgentSchema = z.object({
  template_id: z.string().uuid("Invalid template ID format"),
  bank_specific_name: z.string().min(1, "Bank specific name is required"),
  configuration_json: z.record(z.any()).optional(), // Allows any valid JSON object
  status: z.enum(['active', 'inactive', 'error']).optional(),
});
export type ConfiguredAgentInput = z.infer<typeof configuredAgentSchema>;


export const createConfiguredAgent = async (data: ConfiguredAgentInput, userId: string) => {
  const { template_id, bank_specific_name, configuration_json, status } = data;
  // TODO: Validate configuration_json against the schema from agent_templates.configurable_params_json_schema
  // This would require fetching the template first. For now, we assume it's valid or validated by frontend.

  const result = await query(
    'INSERT INTO configured_agents (template_id, user_id, bank_specific_name, configuration_json, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [template_id, userId, bank_specific_name, configuration_json || {}, status || 'active']
  );
  return result.rows[0];
};

export const getAllConfiguredAgents = async (userId?: string) => { // Optional userId to filter by user
  if (userId) {
    const result = await query('SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id WHERE ca.user_id = $1 ORDER BY ca.bank_specific_name ASC', [userId]);
    return result.rows;
  }
  // For platform admin, maybe list all? Or enforce user_id always? For now, only by user.
  const result = await query('SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id ORDER BY ca.bank_specific_name ASC');
  return result.rows;
};

export const getConfiguredAgentById = async (agentId: string, userId?: string) => {
  if (userId) {
    const result = await query('SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id WHERE agent_id = $1 AND ca.user_id = $2', [agentId, userId]);
    return result.rows[0] || null;
  }
  const result = await query('SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id WHERE agent_id = $1', [agentId]);
  return result.rows[0] || null;
};

export const updateConfiguredAgent = async (agentId: string, data: Partial<ConfiguredAgentInput>, userId: string) => {
  // TODO: Add validation that this user is allowed to update this agent.
  // TODO: Validate configuration_json against the schema from agent_templates if it's being updated.
  const fields = Object.keys(data) as (keyof Partial<ConfiguredAgentInput>)[];
  const values = Object.values(data);

  if (fields.length === 0) {
    return getConfiguredAgentById(agentId, userId);
  }

  const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
  // Ensure user_id matches for update, or role-based logic
  const queryString = `UPDATE configured_agents SET ${setClauses} WHERE agent_id = $1 AND user_id = $${fields.length + 2} RETURNING *`;

  const result = await query(queryString, [agentId, ...values, userId]);
  return result.rows[0] || null;
};

export const deleteConfiguredAgent = async (agentId: string, userId: string) => {
  // Ensure user_id matches for delete, or role-based logic
  const result = await query('DELETE FROM configured_agents WHERE agent_id = $1 AND user_id = $2 RETURNING *', [agentId, userId]);
  return result.rows[0] || null;
};


// Placeholder for agent execution logic
export const executeAgent = async (agentId: string, inputData: any) => {
  // 1. Fetch configured_agent details (includes configuration_json and template_id)
  // 2. Fetch agent_template details (includes core_logic_identifier)
  // 3. Based on core_logic_identifier, call the appropriate service/function
  //    passing it the configuration_json and inputData.
  // This is a simplified mock for now.
  console.log(`Executing agent ${agentId} with data:`, inputData);
  const agent = await getConfiguredAgentById(agentId); // This fetches joined template_name
  if (!agent) {
    throw new Error('Configured agent not found');
  }

  // Fetch the full template to get core_logic_identifier
  const agentTemplate = await getAgentTemplateById(agent.template_id);
  if (!agentTemplate) {
      throw new Error(`Agent template with ID ${agent.template_id} not found for configured agent ${agentId}`);
  }

  console.log(`Executing agent ${agentId} (${agent.bank_specific_name}) using template ${agentTemplate.name} identified by '${agentTemplate.core_logic_identifier}'`);

  // Call specific logic based on core_logic_identifier
  if (agentTemplate.core_logic_identifier === LOAN_CHECKER_AGENT_LOGIC_ID) {
    // Validate and use agent.configuration_json and inputData
    const validatedConfig = loanCheckerAgentConfigSchema.parse(agent.configuration_json || {});
    const validatedInputForLoanChecker = loanCheckerAgentInputSchema.parse(inputData || {});

    const loanCheckerOutput = await executeLoanCheckerAgentLogic(validatedConfig, validatedInputForLoanChecker);
    return { success: true, message: `Agent ${agent.bank_specific_name} (Loan Checker) executed.`, output: loanCheckerOutput };

  } else if (agentTemplate.core_logic_identifier === DATA_EXTRACTOR_AGENT_LOGIC_ID) {
    const validatedConfig = dataExtractorAgentConfigSchema.parse(agent.configuration_json || {});
    // Input data for data extractor is expected to be { data: { actual_input_object } }
    // The actual_input_object is what sourceDataFieldPath refers to.
    const validatedInput = dataExtractorAgentInputSchema.parse(inputData ? { data: inputData } : {data: {}});

    const extractorOutput = await executeDataExtractorAgentLogic(validatedConfig, validatedInput);
    return { success: true, message: `Agent ${agent.bank_specific_name} (Data Extractor) executed.`, output: extractorOutput };
  }

  // Placeholder for other agent logic identifiers
  console.warn(`No specific logic implemented for core_logic_identifier: ${agentTemplate.core_logic_identifier}`);
  return { success: false, message: `Agent ${agent.bank_specific_name} execution failed: No logic for template type.`, output: null };
};


export interface AgentSelectionCriteria {
  name_matches?: string; // For bank_specific_name (exact or pattern)
  template_id?: string; // Exact template_id
  template_name?: string; // Exact name from agent_templates table
  status?: 'active' | 'inactive' | 'error';
  // Future: tags?: string[]; // If configured_agents get a tags JSONB field
}

export const findConfiguredAgentByCriteria = async (criteria: AgentSelectionCriteria, userId?: string): Promise<any | null> => {
  let queryStr = 'SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id';
  const conditions: string[] = [];
  const values: any[] = [];
  let valueIndex = 1;

  if (userId) {
    conditions.push(`ca.user_id = $${valueIndex++}`);
    values.push(userId);
  }

  if (criteria.name_matches) {
    // Using LIKE for pattern matching, could also offer exact match
    conditions.push(`ca.bank_specific_name ILIKE $${valueIndex++}`); // ILIKE for case-insensitive
    values.push(`%${criteria.name_matches}%`); // Wildcard search
  }

  if (criteria.template_id) {
    conditions.push(`ca.template_id = $${valueIndex++}`);
    values.push(criteria.template_id);
  }

  if (criteria.template_name) {
    conditions.push(`at.name = $${valueIndex++}`);
    values.push(criteria.template_name);
  }

  if (criteria.status) {
    conditions.push(`ca.status = $${valueIndex++}`);
    values.push(criteria.status);
  } else {
    // Default to only selecting 'active' agents if no specific status is requested
    conditions.push(`ca.status = 'active'`);
  }

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ');
  }

  queryStr += ' ORDER BY ca.created_at DESC LIMIT 1'; // Get the most recently created one if multiple match

  console.log('Dynamic agent query:', queryStr, values);
  const result = await query(queryStr, values);
  return result.rows[0] || null;
};
