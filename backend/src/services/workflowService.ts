import { query } from '../config/db';
import { z } from 'zod';

// Zod schema for Workflow definition

// Forward declaration for recursive step schema
const baseWorkflowStepDefinitionSchemaWithoutRef = z.object({
  name: z.string(),
  type: z.enum(['agent_execution', 'human_review', 'data_input', 'decision', 'parallel', 'join', 'end', 'sub_workflow']),
  description: z.string().optional(),

  // For 'agent_execution'
  agent_core_logic_identifier: z.string().optional(), // Legacy or for template identification
  configured_agent_id: z.string().uuid().optional(), // Direct assignment of a configured agent instance
  agent_selection_criteria: z.record(z.any()).optional(), // For dynamic selection of an agent instance

  // For human tasks
  assigned_role: z.string().optional(),
  form_schema: z.record(z.any()).optional(),

  // For 'parallel' type
  join_on: z.string().optional(),

  // For 'sub_workflow' type
  sub_workflow_name: z.string().optional(),
  sub_workflow_version: z.number().int().positive().optional(),
  input_mapping: z.record(z.string()).optional(),

  // Common fields
  transitions: z.array(z.object({
    to: z.string(),
    condition_type: z.enum(['always', 'on_output_value']).optional(),
    field: z.string().optional(),
    operator: z.enum(['==', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains', 'exists', 'not_exists']).optional(),
    value: z.any().optional(),
    description: z.string().optional(),
  })).optional(),
  final_status: z.enum(['approved', 'rejected', 'completed']).optional(),
  default_input: z.record(z.any()).optional(),
  output_namespace: z.string().optional(),
});

// Define WorkflowBranch schema using a lazy reference for steps within branches
const workflowBranchSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    start_step: z.string(),
    steps: z.array(baseWorkflowStepDefinitionSchema), // Recursive reference here
  })
);

// Now define the full step schema including branches
const baseWorkflowStepDefinitionSchema = baseWorkflowStepDefinitionSchemaWithoutRef.extend({
  branches: z.array(workflowBranchSchema).optional(),
});


export const workflowDefinitionJsonSchema = z.object({
  name: z.string().optional(), // Name within JSON, might mirror main workflow name
  description: z.string().optional(),
  initialContextSchema: z.record(z.any()).optional(),
  steps: z.array(baseWorkflowStepDefinitionSchema),
  start_step: z.string(),
}).refine(data => { // Validate step names and transitions
  const stepNames = new Set(data.steps.map(s => s.name));
  if (!stepNames.has(data.start_step)) {
    // This refine check might be better placed directly in workflowDefinitionSchema for definition_json
    // or handled by a dedicated validation function called by the service.
    // For now, keeping it here as an example of post-parsing validation.
    // throw new Error(`Start step "${data.start_step}" not found in defined steps.`);
    // A Zod way: context.addIssue({ code: z.ZodIssueCode.custom, message: "..." })
    // However, refine at this level doesn't have `context` easily. Better to validate in a separate function.
    return true; // Placeholder: detailed validation to be done elsewhere or via stricter schema.
  }
  for (const step of data.steps) {
    if (step.transitions) {
      for (const transition of step.transitions) {
        if (!stepNames.has(transition.to)) {
          // throw new Error(`Step "${step.name}" transitions to undefined step "${transition.to}".`);
          return true; // Placeholder
        }
      }
    }
    if (step.type === 'parallel') {
        if (!step.join_on || !stepNames.has(step.join_on)) {
            // throw new Error(`Parallel step "${step.name}" must have a valid join_on step name.`);
            return true; // Placeholder
        }
        if (!step.branches || step.branches.length < 1) { // Typically expect >= 2 branches, but >=1 for schema
             // throw new Error(`Parallel step "${step.name}" must have at least one branch defined.`);
            return true; // Placeholder
        }
        for (const branch of step.branches) {
            if (!branch.steps || branch.steps.length === 0) {
                // throw new Error(`Branch "${branch.name}" in parallel step "${step.name}" must have at least one step.`);
                return true; // Placeholder
            }
            const branchStepNames = new Set(branch.steps.map(bs => bs.name));
            if (!branchStepNames.has(branch.start_step)) {
                 // throw new Error(`Start step "${branch.start_step}" for branch "${branch.name}" not found in branch steps.`);
                return true; // Placeholder
            }
            // Recursively validate steps within branches (Zod handles schema, this is for logic)
        }
    }
  }
  return true;
}, { message: "Invalid workflow structure (e.g., missing start step, invalid transitions, parallel/join mismatch)." });


export const workflowDefinitionSchema = z.object({
  name: z.string().min(3, "Workflow name must be at least 3 characters"),
  description: z.string().optional(),
  definition_json: workflowDefinitionJsonSchema, // Use the detailed schema here
  version: z.number().int().positive().default(1),
  is_active: z.boolean().default(true),
});
export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionSchema>;


// Dedicated validation function for workflow logic (called after Zod schema validation)
const validateWorkflowLogic = (definitionJson: z.infer<typeof workflowDefinitionJsonSchema>) => {
    const issues: string[] = [];
    const allStepNames = new Set(definitionJson.steps.map(s => s.name));

    if (!allStepNames.has(definitionJson.start_step)) {
        issues.push(`Start step "${definitionJson.start_step}" is not defined in the steps array.`);
    }

    const validateStepsRecursive = (steps: z.infer<typeof baseWorkflowStepDefinitionSchema>[], contextPath: string) => {
        for (const step of steps) {
            const currentPath = `${contextPath}.${step.name}`;
            // Validate transitions
            if (step.transitions) {
                for (const transition of step.transitions) {
                    if (!allStepNames.has(transition.to)) {
                        // Check if 'to' is a step within the current branch if applicable (not simple here)
                        // For now, assume transitions always point to top-level step names
                        issues.push(`Step "${currentPath}" transitions to an undefined step "${transition.to}".`);
                    }
                }
            }

            // Validate parallel steps
            if (step.type === 'parallel') {
                if (!step.join_on || !allStepNames.has(step.join_on)) {
                    issues.push(`Parallel step "${currentPath}" must have a 'join_on' field referencing a defined top-level step.`);
                } else {
                    const joinStep = definitionJson.steps.find(s => s.name === step.join_on);
                    if (joinStep && joinStep.type !== 'join') {
                        issues.push(`Step "${step.join_on}" referenced by parallel step "${currentPath}" must be of type "join".`);
                    }
                }

                if (!step.branches || step.branches.length < 1) { // Typically want >= 2 branches, but schema allows >=1
                    issues.push(`Parallel step "${currentPath}" must have at least one branch defined.`);
                } else {
                    for (const branch of step.branches) {
                        const branchPath = `${currentPath}.branch(${branch.name})`;
                        if (!branch.steps || branch.steps.length === 0) {
                            issues.push(`Branch "${branch.name}" in parallel step "${currentPath}" must define at least one step.`);
                            continue;
                        }
                        const branchStepNames = new Set(branch.steps.map(bs => bs.name));
                        if (!branchStepNames.has(branch.start_step)) {
                            issues.push(`Start step "${branch.start_step}" for branch "${branch.name}" (in "${currentPath}") not found within that branch's defined steps.`);
                        }
                        // Validate that last step of each branch transitions to the join_on step
                        const lastStepInBranch = branch.steps[branch.steps.length -1];
                        if (!lastStepInBranch.transitions || !lastStepInBranch.transitions.some(t => t.to === step.join_on)) {
                            issues.push(`The last step ("${lastStepInBranch.name}") of branch "${branch.name}" (in "${currentPath}") must transition to the join step "${step.join_on}".`);
                        }
                        validateStepsRecursive(branch.steps, branchPath); // Recursive validation for steps within the branch
                    }
                }
            }
             // Validate join steps (optional, as their main validation is being correctly targeted)
            if (step.type === 'join') {
                // Check if this join step is actually used by any parallel step
                const isUsedByParallel = definitionJson.steps.some(s => s.type === 'parallel' && s.join_on === step.name);
                if (!isUsedByParallel) {
                    // This might be a soft warning rather than a hard error, as a join step could be temporarily orphaned during editing.
                    // For now, let's make it an issue.
                    issues.push(`Join step "${currentPath}" is defined but not used as a 'join_on' target by any parallel step.`);
                }
            }

            // Validate sub_workflow steps
            if (step.type === 'sub_workflow') {
                if (!step.sub_workflow_name) {
                    issues.push(`Sub-workflow step "${currentPath}" must have a 'sub_workflow_name' defined.`);
                }
                // Optional: Could add a check here to see if the named sub-workflow (and version, if specified)
                // actually exists in the database. This might be too slow for real-time validation in an editor
                // and could make definitions too tightly coupled during design time.
                // For now, just ensuring the field is present.
            }

            // Validate agent_execution steps
            if (step.type === 'agent_execution') {
                const hasDirectId = !!step.configured_agent_id;
                const hasCriteria = !!step.agent_selection_criteria && Object.keys(step.agent_selection_criteria).length > 0;
                const hasLegacyIdentifier = !!step.agent_core_logic_identifier;

                if (!hasDirectId && !hasCriteria && !hasLegacyIdentifier) {
                    issues.push(`Agent execution step "${currentPath}" must have 'configured_agent_id', 'agent_selection_criteria', or 'agent_core_logic_identifier'.`);
                }
                if (hasDirectId && hasCriteria) {
                    issues.push(`Agent execution step "${currentPath}" cannot have both 'configured_agent_id' and 'agent_selection_criteria'. Choose one method.`);
                }
                // Further validation of criteria structure could be added if specific keys are expected.
            }
        }
    };

    validateStepsRecursive(definitionJson.steps, 'workflow');

    if (issues.length > 0) {
        throw new Error(`Workflow definition logical validation failed: ${issues.join('; ')}`);
    }
};


export const createWorkflowDefinition = async (data: WorkflowDefinitionInput) => {
  // Zod already applies defaults for version and is_active if not provided
  const { name, description, definition_json, version, is_active } = data;

  // Validate workflow logic (transitions, parallel/join structure, etc.)
  validateWorkflowLogic(definition_json); // This will throw if issues are found

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

  // Validate logic if definition_json is being updated
  if (data.definition_json) {
    // The Zod schema for WorkflowDefinitionInput already validates the structure of definition_json.
    // We need to call our custom logic validator here.
    validateWorkflowLogic(data.definition_json as z.infer<typeof workflowDefinitionJsonSchema>);
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
