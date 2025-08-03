import { query } from '../config/db';
import { z } from 'zod';

// Zod schema for Workflow definition

// Forward declaration for recursive step schema
const baseWorkflowStepDefinitionSchemaWithoutRef = z.object({
  name: z.string(),
  type: z.enum(['agent_execution', 'human_review', 'data_input', 'decision', 'parallel', 'join', 'end', 'sub_workflow']), // Added sub_workflow
  description: z.string().optional(),
  agent_core_logic_identifier: z.string().optional(), // For agent_execution
  assigned_role: z.string().optional(), // For human_review, data_input, decision
  form_schema: z.record(z.any()).optional(), // For human_review, data_input, decision

  // For 'parallel' type
  join_on: z.string().optional(),

  // For 'sub_workflow' type
  sub_workflow_name: z.string().optional(),
  sub_workflow_version: z.number().int().positive().optional(),
  input_mapping: z.record(z.string()).optional(), // e.g. {"subWorkflowVar": "parentContext.valueToMap"}

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

// Workflow definition schema
const workflowDefinitionInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.number().int().positive().optional(), // If not provided, auto-increment
  start_step: z.string(),
  steps: z.array(baseWorkflowStepDefinitionSchema),
});

export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionInputSchema>;

// Response schemas
const workflowDefinitionSchema = z.object({
  workflow_id: z.string().uuid(),
  name: z.string(),
  version: z.number().int().positive(),
  description: z.string().nullable(),
  definition_json: z.record(z.any()),
  status: z.enum(['draft', 'active', 'deprecated']),
  created_by: z.string().uuid().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

const errorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// Create a new workflow definition
export const createWorkflowDefinition = async (definitionData: WorkflowDefinitionInput, createdBy?: string) => {
  // Validate input
  const validatedData = workflowDefinitionInputSchema.parse(definitionData);

  // Determine the next version for this workflow name
  let version = validatedData.version;
  if (!version) {
    const latestVersionResult = await query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM workflows WHERE name = $1',
      [validatedData.name]
    );
    version = latestVersionResult.rows[0].next_version;
  }

  // Check if this name+version already exists
  const existingResult = await query(
    'SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2',
    [validatedData.name, version]
  );
  
  if (existingResult.rows.length > 0) {
    throw new Error(`Workflow '${validatedData.name}' version ${version} already exists`);
  }

  // Insert new workflow
  const result = await query(
    `INSERT INTO workflows (name, version, description, definition_json, status, created_by, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      validatedData.name,
      version,
      validatedData.description || null,
      JSON.stringify(validatedData),
      'draft', // Default status
      createdBy || null,
      false // Default is_active
    ]
  );

  return result.rows[0];
};

// Get all workflow definitions with optional filtering
export const getAllWorkflowDefinitions = async (filters: {
  name?: string,
  status?: string,
  isActive?: boolean,
  createdBy?: string
} = {}) => {
  let queryString = 'SELECT * FROM workflows WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.name) {
    queryString += ` AND name ILIKE $${paramIndex}`;
    params.push(`%${filters.name}%`);
    paramIndex++;
  }

  if (filters.status) {
    queryString += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.isActive !== undefined) {
    queryString += ` AND is_active = $${paramIndex}`;
    params.push(filters.isActive);
    paramIndex++;
  }

  if (filters.createdBy) {
    queryString += ` AND created_by = $${paramIndex}`;
    params.push(filters.createdBy);
    paramIndex++;
  }

  queryString += ' ORDER BY name, version DESC';

  const result = await query(queryString, params);
  return result.rows;
};

// Get a specific workflow definition by ID
export const getWorkflowDefinitionById = async (workflowId: string) => {
  const result = await query('SELECT * FROM workflows WHERE workflow_id = $1', [workflowId]);
  return result.rows[0] || null;
};

// Get a specific workflow definition by name and version
export const getWorkflowDefinitionByNameAndVersion = async (name: string, version?: number) => {
  let queryString: string;
  let params: any[];

  if (version) {
    queryString = 'SELECT * FROM workflows WHERE name = $1 AND version = $2';
    params = [name, version];
  } else {
    // Get the latest active version
    queryString = 'SELECT * FROM workflows WHERE name = $1 AND is_active = true ORDER BY version DESC LIMIT 1';
    params = [name];
  }

  const result = await query(queryString, params);
  return result.rows[0] || null;
};

// Update workflow definition
export const updateWorkflowDefinition = async (workflowId: string, updates: Partial<WorkflowDefinitionInput & { status: string, is_active: boolean }>) => {
  const allowedFields = ['description', 'definition_json', 'status', 'is_active'];
  const updateFields: string[] = [];
  const values: any[] = [workflowId];
  let paramIndex = 2;

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = $${paramIndex}`);
      values.push(updates[key as keyof typeof updates]);
      paramIndex++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  // Always update the updated_at timestamp
  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

  const queryString = `UPDATE workflows SET ${updateFields.join(', ')} WHERE workflow_id = $1 RETURNING *`;
  const result = await query(queryString, values);
  
  if (result.rows.length === 0) {
    throw new Error('Workflow definition not found');
  }

  return result.rows[0];
};

// Delete workflow definition
export const deleteWorkflowDefinition = async (workflowId: string) => {
  // Check if there are active runs for this workflow
  const activeRunsResult = await query(
    'SELECT COUNT(*) as count FROM workflow_runs WHERE workflow_id = $1 AND status IN ($2, $3)',
    [workflowId, 'pending', 'in_progress']
  );

  if (parseInt(activeRunsResult.rows[0].count) > 0) {
    throw new Error('Cannot delete workflow definition with active runs');
  }

  const result = await query('DELETE FROM workflows WHERE workflow_id = $1 RETURNING *', [workflowId]);
  
  if (result.rows.length === 0) {
    throw new Error('Workflow definition not found');
  }

  return result.rows[0];
};

// Activate a workflow version (and deactivate others with the same name)
export const activateWorkflowVersion = async (workflowId: string) => {
  const workflow = await getWorkflowDefinitionById(workflowId);
  if (!workflow) {
    throw new Error('Workflow definition not found');
  }

  // Start transaction
  await query('BEGIN');

  try {
    // Deactivate all other versions of this workflow
    await query(
      'UPDATE workflows SET is_active = false WHERE name = $1 AND workflow_id != $2',
      [workflow.name, workflowId]
    );

    // Activate this version and set status to active
    const result = await query(
      'UPDATE workflows SET is_active = true, status = $1, updated_at = CURRENT_TIMESTAMP WHERE workflow_id = $2 RETURNING *',
      ['active', workflowId]
    );

    await query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
};

// Create a new version from the latest version
export const createNewWorkflowVersionFromLatest = async (workflowName: string, updates: Partial<WorkflowDefinitionInput>) => {
  // Get the latest version
  const latestVersion = await query(
    'SELECT * FROM workflows WHERE name = $1 ORDER BY version DESC LIMIT 1',
    [workflowName]
  );

  if (latestVersion.rows.length === 0) {
    throw new Error(`No existing workflow found with name '${workflowName}'`);
  }

  const latest = latestVersion.rows[0];
  const currentDefinition = latest.definition_json;

  // Get next version number
  const nextVersionResult = await query(
    'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM workflows WHERE name = $1',
    [workflowName]
  );
  const nextVersion = nextVersionResult.rows[0].next_version;

  // Merge the updates with the current definition
  const newDefinition = {
    ...currentDefinition,
    ...updates,
    name: workflowName,
    version: nextVersion
  };

  // Validate the new definition
  const validatedData = workflowDefinitionInputSchema.parse(newDefinition);

  // Create the new version
  const result = await query(
    `INSERT INTO workflows (name, version, description, definition_json, status, created_by, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      validatedData.name,
      nextVersion,
      validatedData.description || latest.description,
      JSON.stringify(validatedData),
      'draft',
      latest.created_by,
      false
    ]
  );

  return result.rows[0];
};

// Get workflow statistics
export const getWorkflowStatistics = async (workflowId?: string) => {
  let queryString = `
    SELECT 
      w.workflow_id,
      w.name,
      w.version,
      COUNT(wr.run_id) as total_runs,
      COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as completed_runs,
      COUNT(CASE WHEN wr.status = 'failed' THEN 1 END) as failed_runs,
      COUNT(CASE WHEN wr.status IN ('pending', 'in_progress') THEN 1 END) as active_runs,
      AVG(EXTRACT(EPOCH FROM (wr.end_time - wr.start_time))) as avg_duration_seconds
    FROM workflows w
    LEFT JOIN workflow_runs wr ON w.workflow_id = wr.workflow_id
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (workflowId) {
    queryString += ' WHERE w.workflow_id = $1';
    params.push(workflowId);
    paramIndex++;
  }

  queryString += `
    GROUP BY w.workflow_id, w.name, w.version
    ORDER BY w.name, w.version DESC
  `;

  const result = await query(queryString, params);
  return result.rows;
};

// Seed initial workflow definitions for development
export const seedInitialWorkflowDefinitions = async () => {
  try {
    console.log('Seeding initial workflow definitions...');

    // Check if workflows already exist
    const existingWorkflows = await query('SELECT COUNT(*) as count FROM workflows');
    if (parseInt(existingWorkflows.rows[0].count) > 0) {
      console.log('Workflows already exist, skipping seeding');
      return;
    }

    // Sample workflow 1: Simple Document Processing
    const documentProcessingWorkflow: WorkflowDefinitionInput = {
      name: "Document Processing",
      description: "Process and extract data from uploaded documents",
      start_step: "extract_data",
      steps: [
        {
          name: "extract_data",
          type: "agent_execution",
          description: "Extract data from document using AI",
          agent_core_logic_identifier: "document_processor",
          transitions: [
            { to: "review_extraction", condition_type: "always" }
          ]
        },
        {
          name: "review_extraction",
          type: "human_review",
          description: "Human review of extracted data",
          assigned_role: "data_reviewer",
          form_schema: {
            type: "object",
            properties: {
              extracted_data: { type: "object", title: "Extracted Data" },
              is_accurate: { type: "boolean", title: "Is data accurate?" },
              corrections: { type: "string", title: "Corrections needed" }
            },
            required: ["is_accurate"]
          },
          transitions: [
            { to: "finalize_document", condition_type: "on_output_value", field: "is_accurate", operator: "==", value: true },
            { to: "extract_data", condition_type: "on_output_value", field: "is_accurate", operator: "==", value: false }
          ]
        },
        {
          name: "finalize_document",
          type: "agent_execution",
          description: "Finalize processed document",
          agent_core_logic_identifier: "document_finalizer",
          transitions: [
            { to: "complete", condition_type: "always" }
          ]
        },
        {
          name: "complete",
          type: "end",
          final_status: "completed"
        }
      ]
    };

    // Sample workflow 2: Customer Onboarding with Parallel Processing
    const customerOnboardingWorkflow: WorkflowDefinitionInput = {
      name: "Customer Onboarding",
      description: "Complete customer onboarding with parallel verification",
      start_step: "collect_information",
      steps: [
        {
          name: "collect_information",
          type: "data_input",
          description: "Collect customer information",
          assigned_role: "onboarding_specialist",
          form_schema: {
            type: "object",
            properties: {
              full_name: { type: "string", title: "Full Name" },
              email: { type: "string", format: "email", title: "Email" },
              phone: { type: "string", title: "Phone Number" },
              document_type: { type: "string", enum: ["passport", "license", "id_card"], title: "ID Document Type" }
            },
            required: ["full_name", "email", "phone", "document_type"]
          },
          transitions: [
            { to: "parallel_verification", condition_type: "always" }
          ]
        },
        {
          name: "parallel_verification",
          type: "parallel",
          description: "Parallel verification processes",
          join_on: "join_verification",
          branches: [
            {
              name: "identity_verification",
              start_step: "verify_identity",
              steps: [
                {
                  name: "verify_identity",
                  type: "agent_execution",
                  description: "Verify customer identity",
                  agent_core_logic_identifier: "identity_verifier",
                  output_namespace: "identity_check"
                }
              ]
            },
            {
              name: "background_check",
              start_step: "run_background_check",
              steps: [
                {
                  name: "run_background_check",
                  type: "agent_execution",
                  description: "Run background verification",
                  agent_core_logic_identifier: "background_checker",
                  output_namespace: "background_check"
                }
              ]
            }
          ]
        },
        {
          name: "join_verification",
          type: "join",
          description: "Combine verification results",
          transitions: [
            { to: "final_approval", condition_type: "always" }
          ]
        },
        {
          name: "final_approval",
          type: "human_review",
          description: "Final approval decision",
          assigned_role: "manager",
          form_schema: {
            type: "object",
            properties: {
              decision: { type: "string", enum: ["approve", "reject"], title: "Decision" },
              notes: { type: "string", title: "Notes" }
            },
            required: ["decision"]
          },
          transitions: [
            { to: "approved", condition_type: "on_output_value", field: "decision", operator: "==", value: "approve" },
            { to: "rejected", condition_type: "on_output_value", field: "decision", operator: "==", value: "reject" }
          ]
        },
        {
          name: "approved",
          type: "end",
          final_status: "approved"
        },
        {
          name: "rejected",
          type: "end",
          final_status: "rejected"
        }
      ]
    };

    // Create the workflows
    await createWorkflowDefinition(documentProcessingWorkflow);
    await createWorkflowDefinition(customerOnboardingWorkflow);

    console.log('Successfully seeded initial workflow definitions');

  } catch (error) {
    console.error('Error seeding workflow definitions:', error);
    throw error;
  }
};

// Export schemas for use in routes
export {
  workflowDefinitionInputSchema,
  workflowDefinitionSchema,
  errorResponseSchema
};
