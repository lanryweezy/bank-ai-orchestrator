import { query } from '../config/db';
import { getWorkflowDefinitionById, getWorkflowDefinitionByNameAndVersion } from './workflowService';
import { createTask, completeTask as completeTaskInService, getTaskById, TaskCreationData } from './taskService';
import { executeAgent } from './configuredAgentService'; // Assuming this handles the agent execution
import { z } from 'zod';

// Zod schema for starting a workflow run
export const startWorkflowRunSchema = z.object({
  triggering_data_json: z.record(z.any()).optional(),
  // workflow_name and workflow_version can be used if workflow_id is not provided
  workflow_name: z.string().optional(),
  workflow_version: z.number().int().positive().optional(),
});
export type StartWorkflowRunInput = z.infer<typeof startWorkflowRunSchema>;


export const createWorkflowRun = async (workflowId: string, userId: string | null, inputData?: Record<string, any>) => {
  const result = await query(
    'INSERT INTO workflow_runs (workflow_id, triggering_user_id, triggering_data_json, status, current_step_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [workflowId, userId, inputData || {}, 'pending', null] // Initial status 'pending', current_step_name null
  );
  const newRun = result.rows[0];
  // After creating the run, immediately try to process its first step
  await processWorkflowStep(newRun.run_id);
  return getWorkflowRunById(newRun.run_id); // Fetch again to get updated status/step
};

export const getWorkflowRunById = async (runId: string) => {
  const result = await query(
    `SELECT wr.*, w.name as workflow_name, w.version as workflow_version
     FROM workflow_runs wr
     JOIN workflows w ON wr.workflow_id = w.workflow_id
     WHERE wr.run_id = $1`,
    [runId]
  );
  return result.rows[0] || null;
};

export const getAllWorkflowRuns = async (filters: {workflowId?: string, status?: string, userId?: string} = {}) => {
    let queryString = `
        SELECT wr.*, w.name as workflow_name, w.version as workflow_version
        FROM workflow_runs wr
        JOIN workflows w ON wr.workflow_id = w.workflow_id
    `;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.workflowId) {
        conditions.push(`wr.workflow_id = $${paramIndex++}`);
        params.push(filters.workflowId);
    }
    if (filters.status) {
        conditions.push(`wr.status = $${paramIndex++}`);
        params.push(filters.status);
    }
    if (filters.userId) { // If filtering by user who triggered it
        conditions.push(`wr.triggering_user_id = $${paramIndex++}`);
        params.push(filters.userId);
    }

    if (conditions.length > 0) {
        queryString += ' WHERE ' + conditions.join(' AND ');
    }
    queryString += ' ORDER BY wr.start_time DESC';

    const result = await query(queryString, params);
    return result.rows;
};

export const updateWorkflowRunStatus = async (runId: string, status: string, currentStepName?: string | null, resultsJson?: Record<string, any> | null) => {
  const updates: Partial<any> = { status };
  if (currentStepName !== undefined) updates.current_step_name = currentStepName;
  if (resultsJson !== undefined) updates.results_json = resultsJson;
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.end_time = new Date().toISOString();
  }

  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');

  const queryString = `UPDATE workflow_runs SET ${setClauses} WHERE run_id = $1 RETURNING *`;
  const result = await query(queryString, [runId, ...values]);
  return result.rows[0];
};


// Core orchestration logic
export const processWorkflowStep = async (runId: string, previousTaskOutput?: Record<string, any> | null) => {
  const run = await getWorkflowRunById(runId);
  if (!run || ['completed', 'failed', 'cancelled'].includes(run.status)) {
    console.log(`Workflow run ${runId} is already terminal or not found. No further processing.`);
    return;
  }

  const workflowDefinition = await getWorkflowDefinitionById(run.workflow_id);
  if (!workflowDefinition || !workflowDefinition.definition_json) {
    await updateWorkflowRunStatus(runId, 'failed', run.current_step_name, { error: 'Workflow definition not found or invalid.' });
    return;
  }

  // Parse workflow definition (assuming a simple structure for now)
  // Example: { steps: [ { name: "step1", type: "agent", agentId: "...", nextStep: "step2" }, ... ] }
  const definition = workflowDefinition.definition_json as any; // Cast for now
  const steps = definition.steps as Array<any>;

  let nextStepName = run.current_step_name ? getNextStepName(run.current_step_name, steps, previousTaskOutput) : steps[0]?.name;

  if (!nextStepName) {
    // No more steps, workflow is completed
    await updateWorkflowRunStatus(runId, 'completed', run.current_step_name, previousTaskOutput || run.results_json);
    console.log(`Workflow run ${runId} completed.`);
    return;
  }

  const currentStepDefinition = steps.find(s => s.name === nextStepName);
  if (!currentStepDefinition) {
    await updateWorkflowRunStatus(runId, 'failed', nextStepName, { error: `Step definition for '${nextStepName}' not found.` });
    return;
  }

  // Update run status to 'in_progress' and current step
  await updateWorkflowRunStatus(runId, 'in_progress', nextStepName);

  // Create task for the current step
  const taskData: TaskCreationData = {
    run_id: runId,
    step_name_in_workflow: currentStepDefinition.name,
    type: currentStepDefinition.type, // e.g., 'agent_execution', 'human_review'
    input_data_json: { // Combine global run data with previous step output
        ...(run.triggering_data_json || {}),
        ...(previousTaskOutput || {}),
        ...(currentStepDefinition.default_input || {}) // Default input for this step
    },
  };

  if (currentStepDefinition.type === 'agent_execution') {
    taskData.assigned_to_agent_id = currentStepDefinition.agent_id; // agent_id from workflow step def
    const newTask = await createTask(taskData);
    // Immediately try to execute agent task (can be made async background job)
    try {
      const agentResult = await executeAgent(currentStepDefinition.agent_id, taskData.input_data_json);
      await completeTaskInService(newTask.task_id, agentResult.output || agentResult); // Complete task with agent's output
      await processWorkflowStep(runId, agentResult.output || agentResult); // Process next step
    } catch (agentError: any) {
      await updateTaskStatus(newTask.task_id, 'failed', { error: agentError.message });
      await updateWorkflowRunStatus(runId, 'failed', currentStepDefinition.name, { error: `Agent execution failed for step ${currentStepDefinition.name}: ${agentError.message}` });
    }
  } else if (['human_review', 'data_input', 'decision'].includes(currentStepDefinition.type)) {
    taskData.assigned_to_user_id = currentStepDefinition.assigned_user_id || null;
    taskData.assigned_to_role = currentStepDefinition.assigned_role || null; // Pass assigned_role
    // For human tasks, just create the task. It will be picked up by a user.
    await createTask(taskData);
    console.log(`Human task '${currentStepDefinition.name}' created for run ${runId} (role: ${taskData.assigned_to_role}, user: ${taskData.assigned_to_user_id}).`);
  } else {
    await updateWorkflowRunStatus(runId, 'failed', currentStepDefinition.name, { error: `Unknown task type '${currentStepDefinition.type}' for step ${currentStepDefinition.name}.` });
  }
};

// Helper to get a value from a nested object using a dot-notation path
const getNestedValue = (obj: Record<string, any>, path: string): any => {
  if (!path) return undefined;
  return path.split('.').reduce((currentObject, key) => {
    return currentObject && currentObject[key] !== undefined ? currentObject[key] : undefined;
  }, obj);
};


const evaluateCondition = (
    transition: any, // Should match WorkflowStepTransition type
    previousTaskOutput?: Record<string, any> | null
): boolean => {
    const conditionType = transition.condition_type || 'always'; // Default to always

    if (conditionType === 'always') {
        return true;
    }

    if (conditionType === 'on_output_value') {
        if (!previousTaskOutput || !transition.field || !transition.operator) {
            console.warn("Condition 'on_output_value' missing previousTaskOutput, field, or operator.", transition);
            return false; // Cannot evaluate
        }

        const actualValue = getNestedValue(previousTaskOutput, transition.field);
        const expectedValue = transition.value;

        switch (transition.operator) {
            case '==': return actualValue == expectedValue; // Loose equality for flexibility
            case '!=': return actualValue != expectedValue;
            case '>': return actualValue > expectedValue;
            case '<': return actualValue < expectedValue;
            case '>=': return actualValue >= expectedValue;
            case '<=': return actualValue <= expectedValue;
            case 'exists': return actualValue !== undefined && actualValue !== null;
            case 'not_exists': return actualValue === undefined || actualValue === null;
            case 'contains':
                if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
                    return actualValue.includes(expectedValue);
                }
                if (Array.isArray(actualValue)) {
                    return actualValue.includes(expectedValue);
                }
                return false;
            case 'not_contains':
                if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
                    return !actualValue.includes(expectedValue);
                }
                if (Array.isArray(actualValue)) {
                    return !actualValue.includes(expectedValue);
                }
                return true; // If not a string or array, it "not_contains" anything specific.
            default:
                console.warn(`Unknown operator: ${transition.operator} in condition.`);
                return false;
        }
    }
    return false; // Unknown condition type
};


// Helper to determine next step based on transitions
const getNextStepName = (
    currentStepName: string,
    steps: Array<any>, // Should match WorkflowStepDefinition[]
    previousTaskOutput?: Record<string, any> | null
): string | null => {
  const currentStepDef = steps.find(s => s.name === currentStepName);

  if (!currentStepDef || !currentStepDef.transitions || currentStepDef.transitions.length === 0) {
    // No defined transitions or current step not found, means end of this path or misconfiguration
    return null;
  }

  for (const transition of currentStepDef.transitions) {
    if (evaluateCondition(transition, previousTaskOutput)) {
      return transition.to; // Return the name of the next step
    }
  }

  console.warn(`No matching transition found for step '${currentStepName}' with output:`, previousTaskOutput);
  return null; // No transition condition was met
};


// Helper to update task status (not directly exposed via API, used by engine)
export const updateTaskStatus = async (taskId: string, status: string, outputData?: Record<string, any>) => {
    const task = await getTaskById(taskId);
    if (!task) throw new Error('Task not found for status update.');

    const updates: Partial<any> = { status };
    if (outputData) updates.output_data_json = outputData;

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
    const queryString = `UPDATE tasks SET ${setClauses} WHERE task_id = $1 RETURNING *`;

    const result = await query(queryString, [taskId, ...values]);
    return result.rows[0];
};

// This function is called when a task (usually human) is completed via API
export const processTaskCompletionAndContinueWorkflow = async (taskId: string, outputData: Record<string, any>, completingUserId?: string) => {
    const completedTask = await completeTaskInService(taskId, outputData, completingUserId);
    if (completedTask) {
        await processWorkflowStep(completedTask.run_id, completedTask.output_data_json);
    }
    return completedTask;
};
