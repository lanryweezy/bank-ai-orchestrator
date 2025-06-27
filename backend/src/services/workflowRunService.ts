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
    'INSERT INTO workflow_runs (workflow_id, triggering_user_id, triggering_data_json, status, current_step_name, active_parallel_branches) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [workflowId, userId, inputData || {}, 'pending', null, null] // active_parallel_branches initially null
  );
  const newRun = result.rows[0];
  // After creating the run, immediately try to process its first step
  // Pass initial context (triggering_data_json) to the first step processing
  await processWorkflowStep(newRun.run_id, runId, inputData || {});
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
  const updatedRunResult = await query(queryString, [runId, ...values]);
  const updatedRun = updatedRunResult.rows[0];

  // If the run that just got updated to a terminal status (completed/failed) was a sub-workflow,
  // we need to trigger the resumption of its parent workflow.
  if (updatedRun && (updatedRun.status === 'completed' || updatedRun.status === 'failed')) {
    // Check if this run_id is referenced as a sub_workflow_run_id in any task
    const parentTaskResult = await query(
        `SELECT task_id, run_id as parent_run_id
         FROM tasks
         WHERE sub_workflow_run_id = $1 AND status NOT IN ('completed', 'failed')`, // Find the parent task that's waiting
        [runId]
    );
    if (parentTaskResult.rows.length > 0) {
      const parentTask = parentTaskResult.rows[0];
      console.log(`Sub-workflow run ${runId} has finished with status ${updatedRun.status}. Resuming parent run ${parentTask.parent_run_id}, task ${parentTask.task_id}.`);

      // Mark the parent's sub-workflow task as completed/failed and pass the sub-run's results.
      // This will then call processWorkflowStep for the parent run.
      await processTaskCompletionAndContinueWorkflow(
        parentTask.task_id,
        updatedRun.results_json || { error: `Sub-workflow ${runId} ended with status ${updatedRun.status}` },
        null, // No specific completing user for system-triggered task completion
        updatedRun.status // Pass the sub-workflow's terminal status to the parent task
      );
    }
  }
  return updatedRun;
};

// Helper to merge outputs, simple overwrite for now, specific keys for branches
const mergeOutputs = (currentContext: Record<string, any>, stepOutput: Record<string, any>, outputNamespace?: string) => {
    if (outputNamespace) {
        return { ...currentContext, [outputNamespace]: { ...(currentContext[outputNamespace] || {}), ...stepOutput } };
    }
    return { ...currentContext, ...stepOutput };
};


// Core orchestration logic
export const processWorkflowStep = async (
    runId: string,
    triggeringTaskId: string | null, // ID of the task that completed and triggered this processing, null for initial run
    previousStepOutput?: Record<string, any> | null,
    branchContext?: { parallelStepName: string; branchName: string; joinStepName: string } // Context if processing within a branch
) => {
  const run = await getWorkflowRunById(runId);
  if (!run || ['completed', 'failed', 'cancelled'].includes(run.status)) {
    console.log(`Workflow run ${runId} (Task: ${triggeringTaskId}) is already terminal or not found. No further processing.`);
    return;
  }

  const workflowDefinition = await getWorkflowDefinitionById(run.workflow_id);
  if (!workflowDefinition || !workflowDefinition.definition_json) {
    await updateWorkflowRunStatus(runId, 'failed', run.current_step_name, { error: 'Workflow definition not found or invalid.' });
    return;
  }

  const definition = workflowDefinition.definition_json as any; // any for now, should use proper types from workflowService
  let allStepsInWorkflow = definition.steps as Array<any>; // Top-level steps

  // If in a branch, currentStepName and previousStepOutput are relative to that branch's context
  const currentRunStepName = branchContext ? `${branchContext.parallelStepName}.${branchContext.branchName}.${run.current_step_name}` : run.current_step_name;

  // Determine the set of steps to use (main workflow or branch)
  let currentStepSet = allStepsInWorkflow;
  if (branchContext) {
    const parallelStepDef = allStepsInWorkflow.find(s => s.name === branchContext.parallelStepName && s.type === 'parallel');
    const branchDef = parallelStepDef?.branches?.find((b:any) => b.name === branchContext.branchName);
    if (!branchDef || !branchDef.steps) {
        await updateWorkflowRunStatus(runId, 'failed', currentRunStepName, { error: `Branch ${branchContext.branchName} not found in parallel step ${branchContext.parallelStepName}.` });
        return;
    }
    currentStepSet = branchDef.steps;
  }

  let nextStepName: string | null | undefined = null;
  if (triggeringTaskId === runId) { // Special case: initial trigger for the workflow run
    nextStepName = definition.start_step;
  } else if (run.current_step_name) { // Subsequent steps
    nextStepName = getNextStepName(run.current_step_name, currentStepSet, previousStepOutput);
  } else { // Should have a start_step if not a subsequent step
     nextStepName = definition.start_step;
  }

  // Accumulate context data
  let accumulatedContext = { ...(run.triggering_data_json || {}), ...(run.results_json || {}) };
  if (previousStepOutput) {
    const prevStepDef = currentStepSet.find(s => s.name === run.current_step_name);
    accumulatedContext = mergeOutputs(accumulatedContext, previousStepOutput, prevStepDef?.output_namespace);
  }


  if (!nextStepName) {
    if (branchContext) {
      // End of a branch, try to proceed to the join step
      console.log(`Branch ${branchContext.branchName} of parallel step ${branchContext.parallelStepName} completed for run ${runId}. Output:`, previousStepOutput);
      await markBranchAsCompleted(runId, branchContext.parallelStepName, branchContext.branchName, accumulatedContext);
      await tryProcessJoinStep(runId, branchContext.parallelStepName, branchContext.joinStepName, allStepsInWorkflow);
    } else {
      // No more steps in the main workflow
      await updateWorkflowRunStatus(runId, 'completed', run.current_step_name, accumulatedContext);
      console.log(`Workflow run ${runId} completed.`);
    }
    return;
  }

  const currentStepDefinition = allStepsInWorkflow.find(s => s.name === nextStepName) ||
                                currentStepSet.find(s => s.name === nextStepName); // Search in current context first

  if (!currentStepDefinition) {
    await updateWorkflowRunStatus(runId, 'failed', nextStepName, { error: `Step definition for '${nextStepName}' not found.` });
    return;
  }

  // Update run: set current step name (fully qualified if in branch), and merge outputs into results_json
  const displayStepName = branchContext ? `${branchContext.parallelStepName}.${branchContext.branchName}.${currentStepDefinition.name}` : currentStepDefinition.name;
  await updateWorkflowRunStatus(runId, 'in_progress', displayStepName, accumulatedContext);


  // --- Handle different step types ---
  if (currentStepDefinition.type === 'parallel') {
    console.log(`Processing PARALLEL step: ${currentStepDefinition.name} for run ${runId}`);
    const parallelBranches = currentStepDefinition.branches || [];
    if (parallelBranches.length === 0) {
        await updateWorkflowRunStatus(runId, 'failed', displayStepName, { error: `Parallel step ${currentStepDefinition.name} has no branches defined.`});
        return;
    }
    // Initialize active branches state for this parallel step
    const initialBranchStates = parallelBranches.reduce((acc: any, branch: any) => {
        acc[branch.name] = { status: 'pending', output: null };
        return acc;
    }, {});
    await updateRunActiveParallelBranches(runId, currentStepDefinition.name, initialBranchStates);

    for (const branch of parallelBranches) {
        const firstStepInBranch = branch.steps.find((s:any) => s.name === branch.start_step);
        if (!firstStepInBranch) {
            console.error(`Start step ${branch.start_step} not found in branch ${branch.name} of parallel step ${currentStepDefinition.name}. Skipping branch.`);
            await markBranchAsCompleted(runId, currentStepDefinition.name, branch.name, { error: `Start step ${branch.start_step} not found.` }, 'failed');
            continue;
        }
        // For each branch, process its first step.
        // The branch context is passed down.
        console.log(`Starting branch: ${branch.name} of parallel step ${currentStepDefinition.name} for run ${runId}`);
        await processWorkflowStep(runId, null, accumulatedContext, { // Pass null as triggeringTaskId as it's a new path
            parallelStepName: currentStepDefinition.name,
            branchName: branch.name,
            joinStepName: currentStepDefinition.join_on // The join step defined in the parallel block
        });
    }
    // After launching all branches, the parallel step itself doesn't directly transition.
    // Its branches will eventually hit the join_on step.
    return; // Stop further processing for this parallel step itself.

  } else if (currentStepDefinition.type === 'join') {
    // Join steps are processed when all their inputs are ready (handled by tryProcessJoinStep)
    // If processWorkflowStep lands here directly, it means it's likely the start of the workflow
    // or an explicit transition to a join step, which should be rare.
    // We just log and wait for branches to complete.
    console.log(`Reached JOIN step: ${currentStepDefinition.name} for run ${runId}. Waiting for branches to complete.`);
    // The actual processing of the join step (and transitioning from it) happens in tryProcessJoinStep
    // once all incoming branches are marked as completed.
    return;

  } else if (currentStepDefinition.type === 'agent_execution' || ['human_review', 'data_input', 'decision'].includes(currentStepDefinition.type)) {
    const taskData: TaskCreationData = {
      run_id: runId,
      step_name_in_workflow: currentStepDefinition.name, // Store the simple name
      type: currentStepDefinition.type as any, // Assuming type matches TaskCreationData
      input_data_json: { // Pass the current accumulated context
          ...accumulatedContext,
          ...(currentStepDefinition.default_input || {})
      },
      // Store branch context in task if present, for easier debugging or UI display
      // task_context_json: branchContext ? { branch: branchContext } : undefined,
    };

    if (currentStepDefinition.type === 'agent_execution') {
      // TODO: Refine agent selection. This currently assumes agent_core_logic_identifier IS a configured_agent_id.
      // This needs a lookup mechanism if agent_core_logic_identifier refers to a template.
      taskData.assigned_to_agent_id = currentStepDefinition.agent_core_logic_identifier;
      if (!taskData.assigned_to_agent_id) {
         await updateWorkflowRunStatus(runId, 'failed', displayStepName, { error: `Agent identifier missing for step ${currentStepDefinition.name}` });
         return;
      }
      const newTask = await createTask(taskData);
      // Execute agent and then process next step
      executeAgent(taskData.assigned_to_agent_id, taskData.input_data_json)
        .then(agentResult => {
            const agentOutput = agentResult.output || agentResult;
            completeTaskInService(newTask.task_id, agentOutput); // Complete the agent task
            return processWorkflowStep(runId, newTask.task_id, agentOutput, branchContext);
        })
        .catch(async agentError => {
            await updateTaskStatus(newTask.task_id, 'failed', { error: agentError.message });
            await updateWorkflowRunStatus(runId, 'failed', displayStepName, { error: `Agent execution failed for step ${currentStepDefinition.name}: ${agentError.message}` });
        });

    } else if (['human_review', 'data_input', 'decision'].includes(currentStepDefinition.type)) {
      taskData.assigned_to_user_id = currentStepDefinition.assigned_to_user_id || null;
      taskData.assigned_to_role = currentStepDefinition.assigned_to_role || null;
      await createTask(taskData); // Create task, workflow pauses here until task is completed via API
      console.log(`Human task '${displayStepName}' created for run ${runId}.`);

    } else if (currentStepDefinition.type === 'sub_workflow') {
        console.log(`Processing SUB_WORKFLOW step: ${currentStepDefinition.name} for run ${runId}`);
        const { sub_workflow_name, sub_workflow_version, input_mapping, output_namespace } = currentStepDefinition;

        if (!sub_workflow_name) {
            await updateWorkflowRunStatus(runId, 'failed', displayStepName, { error: `Sub-workflow step "${currentStepDefinition.name}" is missing 'sub_workflow_name'.` });
            return;
        }

        const subWorkflowDef = await getWorkflowDefinitionByNameAndVersion(sub_workflow_name, sub_workflow_version);
        if (!subWorkflowDef) {
            await updateWorkflowRunStatus(runId, 'failed', displayStepName, { error: `Sub-workflow definition "${sub_workflow_name}" (version: ${sub_workflow_version || 'latest active'}) not found or not active.` });
            return;
        }

        let subWorkflowInputs = { ...accumulatedContext }; // Default to pass all current context
        if (input_mapping) {
            subWorkflowInputs = {};
            for (const key in input_mapping) {
                // Path is dot-notation from accumulatedContext
                const value = getNestedValue(accumulatedContext, input_mapping[key]);
                if (value !== undefined) {
                    subWorkflowInputs[key] = value;
                } else {
                    console.warn(`Input mapping for sub-workflow: key "${input_mapping[key]}" not found in parent context for step "${currentStepDefinition.name}".`);
                }
            }
        }

        // Create the task for the sub_workflow step in parent workflow FIRST
        const parentSubWorkflowTask = await createTask({ ...taskData, type: 'sub_workflow' });

        try {
            const subRun = await createWorkflowRun(subWorkflowDef.workflow_id, run.triggering_user_id, subWorkflowInputs);
            // Link parent task to sub-run
            await query('UPDATE tasks SET sub_workflow_run_id = $1 WHERE task_id = $2', [subRun.run_id, parentSubWorkflowTask.task_id]);
            console.log(`Sub-workflow ${sub_workflow_name} (Run ID: ${subRun.run_id}) started for parent task ${parentSubWorkflowTask.task_id}. Parent run ${runId} now waiting.`);
            // Parent workflow now waits. Sub-workflow completion will trigger continuation.
            // For now, this means this path of processWorkflowStep ends.
            // A separate mechanism (e.g. polling or callback) will eventually call processWorkflowStep for the parent again.
        } catch (subRunError: any) {
            console.error(`Failed to start sub-workflow ${sub_workflow_name}:`, subRunError);
            await updateTaskStatus(parentSubWorkflowTask.task_id, 'failed', { error: `Failed to start sub-workflow: ${subRunError.message}` });
            await updateWorkflowRunStatus(runId, 'failed', displayStepName, { error: `Failed to start sub-workflow "${sub_workflow_name}" for step "${currentStepDefinition.name}".` });
        }

    } else if (currentStepDefinition.type === 'end') {
        console.log(`Processing END step: ${currentStepDefinition.name} for run ${runId}`);
        const finalStatus = currentStepDefinition.final_status || 'completed';
        await updateWorkflowRunStatus(runId, finalStatus, displayStepName, accumulatedContext);
        console.log(`Workflow run ${runId} reached end state '${finalStatus}' at step ${currentStepDefinition.name}.`);
    } else {
        await updateWorkflowRunStatus(runId, 'failed', displayStepName, { error: `Unknown task type '${currentStepDefinition.type}' for step ${currentStepDefinition.name}.` });
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

// This function is called when a task (usually human, or system for sub-workflow placeholder) is completed
export const processTaskCompletionAndContinueWorkflow = async (
    taskId: string,
    outputData: Record<string, any>,
    completingUserId?: string | null, // Can be null if system completes it (e.g. sub-workflow)
    taskFinalStatus?: 'completed' | 'failed' // Explicit status for sub-workflow tasks
) => {
    let completedTask = await getTaskById(taskId);
    if (!completedTask) {
        throw new Error(`Task ${taskId} not found during completion process.`);
    }

    // If taskFinalStatus is provided (typically for sub-workflow system completion), use it.
    // Otherwise, default to 'completed'.
    const statusToSet = taskFinalStatus || 'completed';

    completedTask = await completeTaskInService(taskId, outputData, completingUserId, statusToSet);
    if (!completedTask) { // Should not happen if getTaskById found it, but defensive
        throw new Error(`Task ${taskId} completion failed unexpectedly in service.`);
    }

    // Determine if this task was part of a branch - placeholder for now
    // const taskContext = completedTask.task_context_json as any;
    // const branchContext = taskContext?.branch;

    // Crucially, pass the task_id of the task that just completed as triggeringTaskId
    await processWorkflowStep(completedTask.run_id, completedTask.task_id, completedTask.output_data_json /*, branchContext */);
    return completedTask;
};


// --- Helpers for Parallel Execution ---

// This would update a JSONB column in `workflow_runs` table, e.g., `active_parallel_branches`
// Structure of `active_parallel_branches`:
// {
//   "parallelStepName1": { "branchNameA": { status: "completed", output: {...} }, "branchNameB": { status: "pending" } },
//   "parallelStepName2": { ... }
// }
const updateRunActiveParallelBranches = async (runId: string, parallelStepName: string, branchStates: any) => {
    const run = await getWorkflowRunById(runId);
    if (!run) return;
    const currentParallelData = run.active_parallel_branches || {};
    const updatedParallelData = {
        ...currentParallelData,
        [parallelStepName]: branchStates
    };
    await query('UPDATE workflow_runs SET active_parallel_branches = $1 WHERE run_id = $2', [updatedParallelData, runId]);
};

const markBranchAsCompleted = async (runId: string, parallelStepName: string, branchName: string, output: any, status: 'completed' | 'failed' = 'completed') => {
    const run = await getWorkflowRunById(runId);
    if (!run || !run.active_parallel_branches || !run.active_parallel_branches[parallelStepName]) {
        console.error(`Parallel step ${parallelStepName} not found or not initialized for run ${runId}`);
        return;
    }
    const parallelData = run.active_parallel_branches;
    parallelData[parallelStepName][branchName] = { status, output };
    await query('UPDATE workflow_runs SET active_parallel_branches = $1 WHERE run_id = $2', [parallelData, runId]);
    console.log(`Branch ${branchName} of ${parallelStepName} marked as ${status} for run ${runId}.`);
};

const tryProcessJoinStep = async (runId: string, parallelStepName: string, joinStepName: string, allStepsInWorkflow: Array<any>) => {
    const run = await getWorkflowRunById(runId);
    if (!run || !run.active_parallel_branches || !run.active_parallel_branches[parallelStepName]) {
        return; // Not ready or error
    }

    const branchStates = run.active_parallel_branches[parallelStepName];
    const allBranchesFinished = Object.values(branchStates).every((bs: any) => bs.status === 'completed' || bs.status === 'failed');

    if (allBranchesFinished) {
        console.log(`All branches for parallel step ${parallelStepName} finished for run ${runId}. Proceeding to join step ${joinStepName}.`);

        // Aggregate outputs from all completed branches
        let aggregatedOutput: Record<string, any> = {};
        for (const branchName in branchStates) {
            if (branchStates[branchName].status === 'completed') {
                // Namespace branch output by branch name
                aggregatedOutput[branchName] = branchStates[branchName].output;
            } else if (branchStates[branchName].status === 'failed') {
                // If any branch failed, the parallel execution could be considered failed.
                // Or, specific error handling logic for the join step.
                // For now, we'll include failed branch info.
                 aggregatedOutput[branchName] = { error: `Branch ${branchName} failed.`, output: branchStates[branchName].output };
                 // Potentially mark the entire workflow as failed if one branch fails critically
                 // await updateWorkflowRunStatus(runId, 'failed', `${parallelStepName}(failed_branch:${branchName})`, aggregatedOutput);
                 // return;
            }
        }

        // Update current step to be the join step itself before processing it
        // This is important so that transitions from the join step are evaluated correctly
        await updateWorkflowRunStatus(runId, 'in_progress', joinStepName, run.results_json); // Keep existing results_json for now

        // Now process the join step as a normal step, its previousTaskOutput will be the aggregatedOutput
        await processWorkflowStep(runId, null, aggregatedOutput); // Pass null as triggeringTaskId
    } else {
        console.log(`Parallel step ${parallelStepName} for run ${runId} still has pending branches. Waiting.`);
    }
};
