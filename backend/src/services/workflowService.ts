import { query } from '../config/db';
import { z } from 'zod';

// Zod schema for Workflow definition
export const workflowDefinitionSchema = z.object({
  name: z.string().min(3, "Workflow name must be at least 3 characters"),
  description: z.string().optional(),
  definition_json: z.record(z.any()), // JSON object defining steps, transitions, etc.
  version: z.number().int().positive().optional().default(1),
  is_active: z.boolean().optional().default(true),
});
export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionSchema>;

export const createWorkflowDefinition = async (data: WorkflowDefinitionInput) => {
  const { name, description, definition_json, version, is_active } = data;
  // Check if name + version combination already exists
  const existing = await query(
    'SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2',
    [name, version]
  );
  if (existing.rows.length > 0) {
    throw new Error(`Workflow with name "${name}" and version ${version} already exists.`);
  }

  const result = await query(
    'INSERT INTO workflows (name, description, definition_json, version, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, description, definition_json, version, is_active]
  );
  return result.rows[0];
};

export const getWorkflowDefinitionById = async (workflowId: string) => {
  const result = await query('SELECT * FROM workflows WHERE workflow_id = $1', [workflowId]);
  return result.rows[0] || null;
};

export const getWorkflowDefinitionByNameAndVersion = async (name: string, version?: number) => {
  if (version) {
    const result = await query('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true', [name, version]);
    return result.rows[0] || null;
  }
  // Get latest active version if no version specified
  const result = await query('SELECT * FROM workflows WHERE name = $1 AND is_active = true ORDER BY version DESC LIMIT 1', [name]);
  return result.rows[0] || null;
};

export const getAllWorkflowDefinitions = async (onlyActive: boolean = false) => {
  let queryString = 'SELECT * FROM workflows ORDER BY name ASC, version DESC';
  if (onlyActive) {
    queryString = 'SELECT * FROM workflows WHERE is_active = true ORDER BY name ASC, version DESC';
  }
  const result = await query(queryString);
  return result.rows;
};

export const updateWorkflowDefinition = async (workflowId: string, data: Partial<WorkflowDefinitionInput>) => {
  const fields = Object.keys(data) as (keyof Partial<WorkflowDefinitionInput>)[];
  const values = Object.values(data);

  if (fields.length === 0) {
    return getWorkflowDefinitionById(workflowId);
  }

  // Prevent changing name and version directly if it causes conflict, or handle as new version.
  // For simplicity, this update won't allow changing name/version here; create new version instead.
  if (data.name || data.version) {
      // If name or version is part of the update, ensure it doesn't clash
      const currentWorkflow = await getWorkflowDefinitionById(workflowId);
      if (!currentWorkflow) throw new Error('Workflow not found for update.');

      const checkName = data.name || currentWorkflow.name;
      const checkVersion = data.version || currentWorkflow.version;

      if (data.name !== currentWorkflow.name || data.version !== currentWorkflow.version) {
        const existing = await query(
            'SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2 AND workflow_id != $3',
            [checkName, checkVersion, workflowId]
        );
        if (existing.rows.length > 0) {
            throw new Error(`Another workflow with name "${checkName}" and version ${checkVersion} already exists.`);
        }
      }
  }


  const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
  const queryString = `UPDATE workflows SET ${setClauses} WHERE workflow_id = $1 RETURNING *`;

  const result = await query(queryString, [workflowId, ...values]);
  return result.rows[0] || null;
};

// Deleting a workflow definition can be complex due to existing runs.
// Usually, it's better to mark as inactive.
export const DANGEROUS_deleteWorkflowDefinition = async (workflowId: string) => {
  // Check for active workflow_runs before deleting
  // const runs = await query('SELECT run_id FROM workflow_runs WHERE workflow_id = $1 AND status NOT IN ($2, $3)', [workflowId, 'completed', 'failed']);
  // if (runs.rows.length > 0) {
  //   throw new Error('Cannot delete workflow definition: Active runs exist. Mark as inactive instead.');
  // }
  const result = await query('DELETE FROM workflows WHERE workflow_id = $1 RETURNING *', [workflowId]);
  return result.rows[0] || null;
};

// --- Seeding for specific workflow definitions ---
import { LOAN_CHECKER_AGENT_LOGIC_ID } from './agentLogic/loanCheckerAgent'; // For core_logic_identifier

export const LOAN_APPLICATION_WORKFLOW_NAME = "Loan Application Document & Rule Check";

const loanApplicationWorkflowDefinitionJson = {
  name: LOAN_APPLICATION_WORKFLOW_NAME,
  description: "Automated check of submitted loan documents and basic worthiness rules, followed by human review.",
  initialContextSchema: {
    type: "object",
    properties: {
        applicationId: { type: "string", description: "Unique ID for the loan application" },
        applicantName: { type: "string" },
        loanAmount: { type: "number" },
        // submittedDocuments and applicationData will be part of the input to the agent step
        // as per loanCheckerAgent.ts: loanCheckerAgentInputSchema
    },
    required: ["applicationId", "applicantName", "loanAmount"]
  },
  steps: [
    {
      name: "document_and_rule_check",
      type: "agent_execution",
      agent_core_logic_identifier: LOAN_CHECKER_AGENT_LOGIC_ID,
      // Input to this agent step will be composed by the engine.
      // It will expect data matching loanCheckerAgentInputSchema.
      // The workflow engine will need to map triggering_data_json and prior step outputs
      // to the agent's expected input structure.
      // For now, we assume `triggering_data_json` contains `submittedDocuments` and `applicationData`.
      transitions: [
        {
          "to": "human_review",
          "condition_type": "on_output_value", // Example: proceed if agent assessment is not 'Rejected'
          "field": "overallAssessment",
          "operator": "!=",
          "value": "Rejected",
          "description": "Proceed to human review if agent assessment is not outright Rejected."
        },
        {
          "to": "end_rejected_by_agent", // New end state
          "condition_type": "on_output_value",
          "field": "overallAssessment",
          "operator": "==",
          "value": "Rejected",
          "description": "End workflow as Rejected if agent assessment is Rejected."
        },
         {
          "to": "human_review", // Fallback if no specific conditions met above (e.g. if overallAssessment is missing)
          "condition_type": "always",
          "description": "Default to human review if other conditions not met."
        }
      ]
    },
    {
      name: "human_review",
      type: "human_review",
      assigned_role: "loan_officer", // Primary assignment method
      // assigned_user_id: null, // Can be used for specific overrides if needed by logic
      form_schema: {
        type: "object",
        properties: {
            reviewOutcome: { type: "string", enum: ["approved", "rejected", "escalate"], description: "Decision from human review." },
            reviewComments: { type: "string", description: "Comments from human reviewer." }
        },
        required: ["reviewOutcome"]
      },
      transitions: [
        { "to": "end_approved", "condition_type": "on_output_value", "field": "reviewOutcome", "operator": "==", "value": "approved" },
        { "to": "end_rejected_by_human", "condition_type": "on_output_value", "field": "reviewOutcome", "operator": "==", "value": "rejected" },
        { "to": "escalation_review", "condition_type": "on_output_value", "field": "reviewOutcome", "operator": "==", "value": "escalate" }
      ]
    },
    {
        name: "escalation_review",
        type: "human_review",
        assigned_role: "senior_loan_officer", // Primary assignment method
        // assigned_user_id: null,
        form_schema: {
            type: "object",
            properties: {
                escalationOutcome: { type: "string", enum: ["approved", "rejected"] },
                escalationComments: { type: "string" }
            },
            required: ["escalationOutcome"]
        },
        transitions: [
            { "to": "end_approved", "condition_type": "on_output_value", "field": "escalationOutcome", "operator": "==", "value": "approved" },
            { "to": "end_rejected_by_human", "condition_type": "on_output_value", "field": "escalationOutcome", "operator": "==", "value": "rejected" }
        ]
    },
    { "name": "end_approved", "type": "end", "final_status": "approved" },
    { "name": "end_rejected_by_agent", "type": "end", "final_status": "rejected" }, // New end state
    { "name": "end_rejected_by_human", "type": "end", "final_status": "rejected" } // New end state
  ],
  start_step: "document_and_rule_check"
};


export const ensureLoanApplicationWorkflowExists = async () => {
  const existingWorkflow = await getWorkflowDefinitionByNameAndVersion(LOAN_APPLICATION_WORKFLOW_NAME, 1);

  if (!existingWorkflow) {
    console.log(`Seeding '${LOAN_APPLICATION_WORKFLOW_NAME}' workflow definition...`);
    const workflowData: WorkflowDefinitionInput = {
      name: LOAN_APPLICATION_WORKFLOW_NAME,
      description: loanApplicationWorkflowDefinitionJson.description,
      definition_json: loanApplicationWorkflowDefinitionJson as any, // Cast for now
      version: 1,
      is_active: true,
    };
    await createWorkflowDefinition(workflowData);
    console.log(`'${LOAN_APPLICATION_WORKFLOW_NAME}' workflow definition seeded successfully.`);
  } else {
    // console.log(`'${LOAN_APPLICATION_WORKFLOW_NAME}' workflow definition already exists.`);
    // Optionally update if changed:
    // await updateWorkflowDefinition(existingWorkflow.workflow_id, { definition_json: loanApplicationWorkflowDefinitionJson as any });
  }
};

export const seedInitialWorkflowDefinitions = async () => {
    await ensureLoanApplicationWorkflowExists();
    // Add more workflow definition seeding calls here
};
