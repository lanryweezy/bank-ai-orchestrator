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
  const { name, description, definition_json, version = 1, is_active = true } = data;

  // For creating the first version, ensure name doesn't exist with version 1
  if (version === 1) {
    const existingV1 = await query('SELECT workflow_id FROM workflows WHERE name = $1 AND version = 1', [name]);
    if (existingV1.rows.length > 0) {
      throw new Error(`Workflow with name "${name}" and version 1 already exists. Use createNewWorkflowVersion to create subsequent versions.`);
    }
  } else {
    // This function should primarily be for version 1. Creating other versions should use createNewWorkflowVersion.
    // Or, if allowing direct creation of higher versions, ensure the name/version combo is unique.
     const existing = await query('SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2', [name, version]);
     if (existing.rows.length > 0) {
        throw new Error(`Workflow with name "${name}" and version ${version} already exists.`);
     }
  }

  if (is_active) {
    // Deactivate other active versions of the same name
    await query('UPDATE workflows SET is_active = false WHERE name = $1 AND is_active = true', [name]);
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
    const result = await query('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true', [name, version]);
    return result.rows[0] || null;
  }
  // Get latest active version if no version specified
  const result = await query('SELECT * FROM workflows WHERE name = $1 AND is_active = true ORDER BY version DESC LIMIT 1', [name]);
  return result.rows[0] || null;
};

// Get all versions of a workflow by name
export const getAllWorkflowDefinitionsByName = async (name: string) => {
  const result = await query('SELECT * FROM workflows WHERE name = $1 ORDER BY version DESC', [name]);
  return result.rows;
};


export const getAllWorkflowDefinitions = async (onlyActive: boolean = false) => {
  // This might need refinement. Do we list all versions of all workflows? Or just latest active of each name?
  // For admin list, maybe all versions. For user list, latest active of each name.
  // Current implementation lists all records.
  let queryString = 'SELECT * FROM workflows ORDER BY name ASC, version DESC';
  if (onlyActive) {
    // If onlyActive, we should probably get the latest active version for each distinct name
    queryString = `
      SELECT w1.*
      FROM workflows w1
      INNER JOIN (
          SELECT name, MAX(version) as max_version
          FROM workflows
          WHERE is_active = true
          GROUP BY name
      ) w2 ON w1.name = w2.name AND w1.version = w2.max_version
      WHERE w1.is_active = true
      ORDER BY w1.name ASC;
    `;
     const result = await query(queryString);
     return result.rows;
  }
  // If not onlyActive (typically for admin views), return all versions of all workflows
  const result = await query(queryString);
  return result.rows;
};

// Updates a specific workflow definition record (a specific version)
export const updateWorkflowDefinition = async (workflowId: string, data: Partial<WorkflowDefinitionInput>) => {
  const { name, version, ...updateData } = data; // Destructure to prevent name/version changes here

  if (Object.keys(updateData).length === 0) {
    return getWorkflowDefinitionById(workflowId);
  }

  const currentWorkflow = await getWorkflowDefinitionById(workflowId);
  if (!currentWorkflow) {
      throw new Error('Workflow (version) not found for update.');
  }

  // If this version is being activated, deactivate other versions of the same name
  if (updateData.is_active === true && currentWorkflow.is_active === false) {
    await query(
      'UPDATE workflows SET is_active = false WHERE name = $1 AND workflow_id != $2 AND is_active = true',
      [currentWorkflow.name, workflowId]
    );
  }
  // Prevent deactivating the only active version of a workflow name if there are other versions
  // This rule might be too strict or complex for now, consider implications.
  // For now, allow deactivation even if it's the last active one.

  const fields = Object.keys(updateData) as (keyof typeof updateData)[];
  const values = Object.values(updateData);

  const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
  const queryString = `UPDATE workflows SET ${setClauses} WHERE workflow_id = $1 RETURNING *`;

  const result = await query(queryString, [workflowId, ...values]);
  return result.rows[0] || null;
};


export const createNewWorkflowVersion = async (
    baseWorkflowName: string, // Name of the workflow to create a new version for
    newVersionData: Partial<WorkflowDefinitionInput> // description, definition_json, is_active for the new version
) => {
    const latestVersionResult = await query(
        'SELECT MAX(version) as max_version FROM workflows WHERE name = $1',
        [baseWorkflowName]
    );

    let nextVersion = 1;
    if (latestVersionResult.rows.length > 0 && latestVersionResult.rows[0].max_version !== null) {
        nextVersion = latestVersionResult.rows[0].max_version + 1;
    } else {
      // This means no workflow with this name exists yet.
      // This function is for creating a *new version* of an *existing* workflow name.
      // If you want to create the first version, use createWorkflowDefinition.
      // However, we can adapt it to create V1 if no workflow with that name exists.
      // For now, let's assume baseWorkflowName must exist if we are creating a "new version".
      // If we want this to also create V1, then need to fetch base data differently or require it in newVersionData
      const baseWorkflow = await query('SELECT * FROM workflows WHERE name = $1 ORDER BY version DESC LIMIT 1', [baseWorkflowName]);
      if(baseWorkflow.rows.length === 0 && nextVersion === 1) {
        // Allow creating version 1 if the name doesn't exist at all
      } else if (baseWorkflow.rows.length === 0) {
         throw new Error(`Workflow with name "${baseWorkflowName}" not found to create a new version from.`);
      }
    }

    const {
        description = null, // Default to null or copy from previous if desired
        definition_json = {}, // Default to empty or copy
        is_active = true, // New versions are typically active by default
    } = newVersionData;

    // If new version is active, deactivate other versions of the same name
    if (is_active) {
        await query('UPDATE workflows SET is_active = false WHERE name = $1 AND is_active = true', [baseWorkflowName]);
    }

    const result = await query(
        'INSERT INTO workflows (name, description, definition_json, version, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [baseWorkflowName, description, definition_json, nextVersion, is_active]
    );
    return result.rows[0];
};


export const activateWorkflowVersion = async (workflowId: string) => {
    const workflowToActivate = await getWorkflowDefinitionById(workflowId);
    if (!workflowToActivate) {
        throw new Error('Workflow version not found.');
    }

    // Deactivate other versions of the same name
    await query(
        'UPDATE workflows SET is_active = false WHERE name = $1 AND workflow_id != $2 AND is_active = true',
        [workflowToActivate.name, workflowId]
    );

    // Activate the target version
    const result = await query(
        'UPDATE workflows SET is_active = true WHERE workflow_id = $1 RETURNING *',
        [workflowId]
    );
    return result.rows[0];
};


// Deleting a workflow definition (a specific version) can be complex.
export const DANGEROUS_deleteWorkflowDefinition = async (workflowId: string) => {
  // Add checks: e.g., cannot delete the only version, or the only active version if others exist.
  // For now, direct delete of the specific version record.
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
