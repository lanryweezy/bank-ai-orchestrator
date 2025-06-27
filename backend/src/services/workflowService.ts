import { query } from '../config/db';
import { z } from 'zod';

// Zod schema for Workflow definition
export const workflowDefinitionSchema = z.object({
  name: z.string().min(3, "Workflow name must be at least 3 characters"),
  description: z.string().optional(),
  definition_json: z.record(z.any()), // JSON object defining steps, transitions, etc.
  version: z.number().int().positive().default(1), // Default version to 1
  is_active: z.boolean().default(true), // Default to active
});
export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionSchema>;

export const createWorkflowDefinition = async (data: WorkflowDefinitionInput) => {
  // Zod already applies defaults for version and is_active if not provided
  const { name, description, definition_json, version, is_active } = data;

  // Check if name + version combination already exists
  const existing = await query(
    'SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2',
    [name, version]
  );
  if (existing.rows.length > 0) {
    throw new Error(`Workflow with name "${name}" and version ${version} already exists.`);
  }

  // If this new definition is set to be active, deactivate other active versions of the same name.
  if (is_active) {
    await query(
      'UPDATE workflows SET is_active = false WHERE name = $1 AND is_active = true',
      [name]
    );
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

// Get specific active version by name and version number
export const getWorkflowDefinitionByNameAndVersion = async (name: string, version?: number) => {
  if (version) {
    // Users should only be able to start active specific versions
    const result = await query('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true', [name, version]);
    return result.rows[0] || null;
  }
  // Get latest active version if no version specified by the user for starting a run
  const result = await query('SELECT * FROM workflows WHERE name = $1 AND is_active = true ORDER BY version DESC LIMIT 1', [name]);
  return result.rows[0] || null;
};

// Get all versions of a workflow by name (for admin purposes primarily)
export const getAllWorkflowVersionsByName = async (name: string) => {
  const result = await query('SELECT * FROM workflows WHERE name = $1 ORDER BY version DESC', [name]);
  return result.rows;
};


export const getAllWorkflowDefinitions = async (onlyActive: boolean = false) => {
  let queryString = 'SELECT * FROM workflows ORDER BY name ASC, version DESC';
  if (onlyActive) {
    // For user-facing lists, show only the single, latest active version for each workflow name.
    // This ensures users see a clean list of runnable workflows.
    queryString = `
      SELECT w1.*
      FROM workflows w1
      INNER JOIN (
          SELECT name, MAX(version) as max_version
          FROM workflows
          WHERE is_active = true
          GROUP BY name
      ) w2 ON w1.name = w2.name AND w1.version = w2.max_version
      WHERE w1.is_active = true  -- Redundant due to subquery but good for clarity
      ORDER BY w1.name ASC;
    `;
  }
  // If not onlyActive (e.g., for admin views), return all versions of all workflows.
  const result = await query(queryString);
  return result.rows;
};

// Updates a specific workflow definition record (identified by workflowId)
export const updateWorkflowDefinition = async (workflowId: string, data: Partial<WorkflowDefinitionInput>) => {
  const currentWorkflow = await getWorkflowDefinitionById(workflowId);
  if (!currentWorkflow) {
      throw new Error('Workflow definition (version) not found for update.');
  }

  // Fields that can be updated directly on this specific version record
  const allowedUpdateFields: (keyof WorkflowDefinitionInput)[] = ['description', 'definition_json', 'is_active'];
  const updatePayload: Partial<WorkflowDefinitionInput> = {};

  for (const field of allowedUpdateFields) {
    if (data[field] !== undefined) {
      (updatePayload as any)[field] = data[field];
    }
  }

  // Prevent changing name or version directly via this function.
  // Name/version changes should imply creating a new definition or a new version through a different mechanism.
  if (data.name && data.name !== currentWorkflow.name) {
    throw new Error("Cannot change workflow name directly. Create a new workflow definition if needed.");
  }
  if (data.version && data.version !== currentWorkflow.version) {
     throw new Error("Cannot change workflow version directly. Create a new version if needed.");
  }


  if (Object.keys(updatePayload).length === 0) {
    return currentWorkflow; // No valid fields to update
  }

  // If this specific version (workflowId) is being activated
  if (updatePayload.is_active === true && !currentWorkflow.is_active) {
    // Deactivate all other versions of the same workflow name
    await query(
      'UPDATE workflows SET is_active = false WHERE name = $1 AND workflow_id != $2',
      [currentWorkflow.name, workflowId]
    );
  }
  // Optional: Prevent deactivating the last active version of a workflow name if other versions exist.
  // This logic can be complex. For instance, if WF_A v1 (active) and WF_A v2 (inactive) exist,
  // and admin tries to set WF_A v1 to inactive, should it be prevented or allowed?
  // Current simplified approach: Allow deactivation. Admin must explicitly activate another version if desired.

  const fieldsToUpdate = Object.keys(updatePayload) as (keyof typeof updatePayload)[];
  const values = Object.values(updatePayload);

  const setClauses = fieldsToUpdate.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
  const queryString = `UPDATE workflows SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE workflow_id = $1 RETURNING *`;

  const result = await query(queryString, [workflowId, ...values]);
  return result.rows[0] || null;
};


// This function is more explicit for creating a new version based on an existing workflow name.
// Not directly used by admin PUT /:workflowId route which updates a specific version.
// Could be exposed via a new admin route like POST /admin/workflows/:name/versions
export const createNewWorkflowVersionFromLatest = async (
    workflowName: string,
    newVersionDetails: { description?: string; definition_json: Record<string, any>; is_active?: boolean }
) => {
    const latestVersionResult = await query(
        'SELECT * FROM workflows WHERE name = $1 ORDER BY version DESC LIMIT 1',
        [workflowName]
    );

    if (latestVersionResult.rows.length === 0) {
        throw new Error(`Workflow with name "${workflowName}" not found to create a new version from.`);
    }
    const latestVersion = latestVersionResult.rows[0];
    const nextVersionNumber = latestVersion.version + 1;

    const { description = latestVersion.description, definition_json, is_active = true } = newVersionDetails;

    if (is_active) {
        await query('UPDATE workflows SET is_active = false WHERE name = $1 AND is_active = true', [workflowName]);
    }

    const result = await query(
        'INSERT INTO workflows (name, description, definition_json, version, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [workflowName, description, definition_json, nextVersionNumber, is_active]
    );
    return result.rows[0];
};


// This function is explicit for activating a specific workflow version (identified by workflowId).
// It ensures only this version (for its name) is active.
// Could be exposed via POST /admin/workflows/:workflowId/activate
export const activateWorkflowVersion = async (workflowId: string) => {
    const workflowToActivate = await getWorkflowDefinitionById(workflowId);
    if (!workflowToActivate) {
        throw new Error('Workflow version not found.');
    }
    if (workflowToActivate.is_active) {
        return workflowToActivate; // Already active
    }

    // Deactivate other versions of the same name
    await query(
        'UPDATE workflows SET is_active = false WHERE name = $1 AND workflow_id != $2', // And is_active = true is implicit
        [workflowToActivate.name, workflowId]
    );

    // Activate the target version
    const result = await query(
        'UPDATE workflows SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE workflow_id = $1 RETURNING *',
        [workflowId]
    );
    return result.rows[0];
};


// Deleting a workflow definition (a specific version)
export const DANGEROUS_deleteWorkflowDefinition = async (workflowId: string) => {
  // Future checks:
  // 1. Cannot delete if it's the only version of that name.
  // 2. Cannot delete if it's active and there are no other active versions for that name (unless force delete).
  // For now, direct delete. The route handler has FK check for workflow_runs.
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
