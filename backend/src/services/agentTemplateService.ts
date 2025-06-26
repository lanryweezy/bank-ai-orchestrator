import { query } from '../config/db';
import { z } from 'zod';

// Zod schema for AgentTemplate creation and update
export const agentTemplateSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  core_logic_identifier: z.string().min(1, "Core logic identifier is required"),
  configurable_params_json_schema: z.record(z.any()).optional(), // Allows any valid JSON object
});
export type AgentTemplateInput = z.infer<typeof agentTemplateSchema>;

export const createAgentTemplate = async (data: AgentTemplateInput) => {
  const { name, description, core_logic_identifier, configurable_params_json_schema } = data;
  const result = await query(
    'INSERT INTO agent_templates (name, description, core_logic_identifier, configurable_params_json_schema) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, description, core_logic_identifier, configurable_params_json_schema || {}]
  );
  return result.rows[0];
};

export const getAllAgentTemplates = async () => {
  const result = await query('SELECT * FROM agent_templates ORDER BY name ASC');
  return result.rows;
};

export const getAgentTemplateById = async (templateId: string) => {
  const result = await query('SELECT * FROM agent_templates WHERE template_id = $1', [templateId]);
  return result.rows[0] || null;
};

export const updateAgentTemplate = async (templateId: string, data: Partial<AgentTemplateInput>) => {
  // Dynamically build query for partial updates
  const fields = Object.keys(data) as (keyof Partial<AgentTemplateInput>)[];
  const values = Object.values(data);

  if (fields.length === 0) {
    return getAgentTemplateById(templateId); // No fields to update, return current
  }

  const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
  const queryString = `UPDATE agent_templates SET ${setClauses} WHERE template_id = $1 RETURNING *`;

  const result = await query(queryString, [templateId, ...values]);
  return result.rows[0] || null;
};

export const deleteAgentTemplate = async (templateId: string) => {
  const result = await query('DELETE FROM agent_templates WHERE template_id = $1 RETURNING *', [templateId]);
  return result.rows[0] || null;
};

// --- Seeding for specific agent templates ---
import { LOAN_CHECKER_AGENT_LOGIC_ID, loanCheckerAgentJsonSchema } from './agentLogic/loanCheckerAgent';
import { DATA_EXTRACTOR_AGENT_LOGIC_ID, dataExtractorAgentJsonSchema } from './agentLogic/dataExtractorAgent';

export const ensureLoanCheckerAgentTemplateExists = async () => {
  const existingTemplate = await query(
    'SELECT template_id FROM agent_templates WHERE core_logic_identifier = $1',
    [LOAN_CHECKER_AGENT_LOGIC_ID]
  );

  if (existingTemplate.rows.length === 0) {
    console.log(`Seeding '${LOAN_CHECKER_AGENT_LOGIC_ID}' agent template...`);
    const templateData: AgentTemplateInput = {
      name: "Loan Document & Basic Worthiness Checker",
      description: "Checks for required loan documents and evaluates basic worthiness rules against application data.",
      core_logic_identifier: LOAN_CHECKER_AGENT_LOGIC_ID,
      configurable_params_json_schema: loanCheckerAgentJsonSchema as any, // Cast as Zod schema expects record(z.any())
    };
    await createAgentTemplate(templateData);
    console.log(`'${LOAN_CHECKER_AGENT_LOGIC_ID}' agent template seeded successfully.`);
  } else {
    // console.log(`'${LOAN_CHECKER_AGENT_LOGIC_ID}' agent template already exists.`);
    // Optionally, update if changed:
    // await updateAgentTemplate(existingTemplate.rows[0].template_id, { configurable_params_json_schema: loanCheckerAgentJsonSchema as any });
  }
};

// Call this on app startup or via an admin endpoint
// For now, let's call it from server.ts for simplicity during development
// (This is not ideal for production, migrations or dedicated seeding scripts are better)

export const ensureDataExtractorAgentTemplateExists = async () => {
  const existingTemplate = await query(
    'SELECT template_id FROM agent_templates WHERE core_logic_identifier = $1',
    [DATA_EXTRACTOR_AGENT_LOGIC_ID]
  );

  if (existingTemplate.rows.length === 0) {
    console.log(`Seeding '${DATA_EXTRACTOR_AGENT_LOGIC_ID}' agent template...`);
    const templateData: AgentTemplateInput = {
      name: "Data Extraction Agent",
      description: "Extracts structured data from text using regex or simulated AI entity recognition.",
      core_logic_identifier: DATA_EXTRACTOR_AGENT_LOGIC_ID,
      configurable_params_json_schema: dataExtractorAgentJsonSchema as any,
    };
    await createAgentTemplate(templateData);
    console.log(`'${DATA_EXTRACTOR_AGENT_LOGIC_ID}' agent template seeded successfully.`);
  }
};

export const seedInitialAgentTemplates = async () => {
    await ensureLoanCheckerAgentTemplateExists();
    await ensureDataExtractorAgentTemplateExists();
    // Add more template seeding calls here if needed
};
