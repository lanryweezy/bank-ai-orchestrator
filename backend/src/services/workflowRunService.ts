import { query } from '../config/db';
import {
    getWorkflowDefinitionById,
    getWorkflowDefinitionByNameAndVersion,
    WorkflowTransition,
    ConditionGroup,
    SingleCondition,
    ExternalApiCallStepConfig,
    ErrorHandling, // Added import
    OnFailureAction // Added import
} from './workflowService';
import { createTask, completeTask as completeTaskInService, getTaskById, TaskCreationData, updateTask as updateTaskStatusInTaskService } from './taskService'; // Corrected import alias
import { executeAgent } from './configuredAgentService';
import { z } from 'zod';
import axios from 'axios';

// --- START: Helper Function Definitions (Hoisted) ---

function mergeOutputs(currentContext: Record<string, any>, stepOutput: Record<string, any>, outputNamespace?: string) {
    if (outputNamespace) {
        return { ...currentContext, [outputNamespace]: { ...(currentContext[outputNamespace] || {}), ...stepOutput } };
    }
    return { ...currentContext, ...stepOutput };
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!path) return undefined;
  return path.split('.').reduce((currentObject, key) => {
    return currentObject && currentObject[key] !== undefined ? currentObject[key] : undefined;
  }, obj);
}

function resolveTemplate(templateString: string, context: any, secrets: Record<string, string | undefined>): string {
    return templateString.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, placeholder) => {
        const path = placeholder.trim();
        if (path.startsWith('secrets.')) {
            const secretKey = path.substring('secrets.'.length);
            return secrets[secretKey] || `{{SECRET_${secretKey}_NOT_FOUND}}`;
        }
        const value = getNestedValue(context, path);
        return value !== undefined ? String(value) : match;
    });
}

function resolveObjectTemplate(templateObj: Record<string, string> | undefined, context: any, secrets: Record<string, string | undefined>): Record<string, string> | undefined {
    if (!templateObj) return undefined;
    const resolvedObj: Record<string, string> = {};
    for (const key in templateObj) {
        resolvedObj[key] = resolveTemplate(templateObj[key], context, secrets);
    }
    return resolvedObj;
}

function resolveBodyTemplate(template: any, context: any, secrets: Record<string, string | undefined>): any {
    if (typeof template === 'string') {
        return resolveTemplate(template, context, secrets);
    }
    if (typeof template === 'object' && template !== null) {
        const resolved: any = Array.isArray(template) ? [] : {};
        for (const key in template) {
            if (Object.prototype.hasOwnProperty.call(template, key)) {
                resolved[key] = resolveBodyTemplate(template[key], context, secrets);
            }
        }
        return resolved;
    }
    return template;
}

function evaluateSingleCondition(
    condition: SingleCondition,
    context: { output?: Record<string, any> | null; workflowData?: Record<string, any> | null }
): boolean {
    const { field, operator, value: expectedValue } = condition;
    let actualValue: any;
    if (field.startsWith('output.')) {
        actualValue = getNestedValue(context.output || {}, field.substring('output.'.length));
    } else if (field.startsWith('context.')) {
        actualValue = getNestedValue(context.workflowData || {}, field.substring('context.'.length));
    } else {
        actualValue = getNestedValue(context.output || {}, field);
    }
    switch (operator) {
        case '==': return actualValue == expectedValue;
        case '!=': return actualValue != expectedValue;
        case '>': return actualValue > expectedValue;
        case '<': return actualValue < expectedValue;
        case '>=': return actualValue >= expectedValue;
        case '<=': return actualValue <= expectedValue;
        case 'exists': return actualValue !== undefined && actualValue !== null;
        case 'not_exists': return actualValue === undefined || actualValue === null;
        case 'contains':
            if (typeof actualValue === 'string' && typeof expectedValue === 'string') return actualValue.includes(expectedValue);
            if (Array.isArray(actualValue) && expectedValue !== undefined) return actualValue.includes(expectedValue);
            return false;
        case 'not_contains':
            if (typeof actualValue === 'string' && typeof expectedValue === 'string') return !actualValue.includes(expectedValue);
            if (Array.isArray(actualValue) && expectedValue !== undefined) return !actualValue.includes(expectedValue);
            return true;
        case 'regex':
            if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
                try { return new RegExp(expectedValue).test(actualValue); } catch (e) { console.error("Invalid regex:", expectedValue, e); return false; }
            }
            return false;
        default: console.warn(`Unknown operator: ${operator} in condition.`); return false;
    }
}

function evaluateConditionGroup(
    group: ConditionGroup,
    context: { output?: Record<string, any> | null; workflowData?: Record<string, any> | null }
): boolean {
    if (group.logical_operator === 'AND') {
        for (const cond of group.conditions) {
            const result = 'logical_operator' in cond ? evaluateConditionGroup(cond as ConditionGroup, context) : evaluateSingleCondition(cond as SingleCondition, context);
            if (!result) return false;
        }
        return true;
    } else {
        for (const cond of group.conditions) {
            const result = 'logical_operator' in cond ? evaluateConditionGroup(cond as ConditionGroup, context) : evaluateSingleCondition(cond as SingleCondition, context);
            if (result) return true;
        }
        return false;
    }
}

function evaluateTransitionCondition(
    transition: WorkflowTransition,
    context: { output?: Record<string, any> | null; workflowData?: Record<string, any> | null }
): boolean {
    if (transition.condition_type === 'always') return true;
    if (transition.condition_type === 'conditional' && transition.condition_group) return evaluateConditionGroup(transition.condition_group, context);
    console.warn("Invalid transition condition setup:", transition);
    return false;
}

function getNextStepName(
    currentStepName: string,
    steps: Array<any>,
    currentContextData: { output?: Record<string, any> | null; workflowData?: Record<string, any> | null }
): string | null {
  const currentStepDef = steps.find(s => s.name === currentStepName);
  if (!currentStepDef || !currentStepDef.transitions || currentStepDef.transitions.length === 0) return null;
  const transitionsTyped = currentStepDef.transitions as WorkflowTransition[];
  for (const transition of transitionsTyped) {
    if (evaluateTransitionCondition(transition, currentContextData)) return transition.to;
  }
  console.warn(`No matching transition found for step '${currentStepName}' with context:`, currentContextData);
  return null;
}

async function updateRunActiveParallelBranches(runId: string, parallelStepName: string, branchStates: any) {
    const run = await getWorkflowRunById(runId);
    if (!run) return;
    const currentParallelData = run.active_parallel_branches || {};
    const updatedParallelData = { ...currentParallelData, [parallelStepName]: branchStates };
    await query('UPDATE workflow_runs SET active_parallel_branches = $1 WHERE run_id = $2', [updatedParallelData, runId]);
}

async function markBranchAsCompleted(runId: string, parallelStepName: string, branchName: string, output: any, status: 'completed' | 'failed' = 'completed') {
    const run = await getWorkflowRunById(runId);
    if (!run || !run.active_parallel_branches || !run.active_parallel_branches[parallelStepName]) {
        console.error(`Parallel step ${parallelStepName} not found or not initialized for run ${runId}`);
        return;
    }
    const parallelData = run.active_parallel_branches;
    parallelData[parallelStepName][branchName] = { status, output };
    await query('UPDATE workflow_runs SET active_parallel_branches = $1 WHERE run_id = $2', [parallelData, runId]);
    console.log(`Branch ${branchName} of ${parallelStepName} marked as ${status} for run ${runId}.`);
}

async function tryProcessJoinStep(runId: string, parallelStepName: string, joinStepName: string, allStepsInWorkflow: Array<any>) {
    const run = await getWorkflowRunById(runId);
    if (!run || !run.active_parallel_branches || !run.active_parallel_branches[parallelStepName]) return;
    const branchStates = run.active_parallel_branches[parallelStepName];
    const allBranchesFinished = Object.values(branchStates).every((bs: any) => bs.status === 'completed' || bs.status === 'failed');
    if (allBranchesFinished) {
        console.log(`All branches for parallel step ${parallelStepName} finished for run ${runId}. Proceeding to join step ${joinStepName}.`);
        let aggregatedOutput: Record<string, any> = {};
        for (const branchName in branchStates) {
            if (branchStates[branchName].status === 'completed') aggregatedOutput[branchName] = branchStates[branchName].output;
            else if (branchStates[branchName].status === 'failed') aggregatedOutput[branchName] = { error: `Branch ${branchName} failed.`, output: branchStates[branchName].output };
        }
        await updateWorkflowRunStatus(runId, 'in_progress', joinStepName, run.results_json);
        await processWorkflowStep(runId, null, aggregatedOutput);
    } else {
        console.log(`Parallel step ${parallelStepName} for run ${runId} still has pending branches. Waiting.`);
    }
}

async function engineUpdateTaskStatus(taskId: string, status: string, outputData?: Record<string, any>) {
    const task = await getTaskById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found for engine update.`);
    const updates: Partial<any> = { status };
    if (outputData !== undefined) updates.output_data_json = outputData;
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
    const queryString = `UPDATE tasks SET ${setClauses}, updated_at = NOW() WHERE task_id = $1 RETURNING *`;
    const result = await query(queryString, [taskId, ...values]);
    return result.rows[0];
}

async function handleStepFailure(
    runId: string, run: any, currentStepDefinition: any, task: any, error: any,
    accumulatedContext: Record<string, any>, branchContext?: { parallelStepName: string; branchName: string; joinStepName: string }
) {
    const displayStepName = branchContext ? `${branchContext.parallelStepName}.${branchContext.branchName}.${currentStepDefinition.name}` : currentStepDefinition.name;
    const fullTask = await getTaskById(task.task_id);
    if (!fullTask) {
        console.error(`Run ${runId}, Step ${displayStepName}: Task ${task.task_id} not found during error handling.`);
        await updateWorkflowRunStatus(runId, 'failed', displayStepName, { ...accumulatedContext, error: `Task ${task.task_id} disappeared.` });
        return;
    }
    let currentRetryCount = fullTask.retry_count || 0;
    const errorHandlingConfig = currentStepDefinition.error_handling as ErrorHandling | undefined;

    if (errorHandlingConfig?.retry_policy && errorHandlingConfig.retry_policy.max_attempts > 1 && currentRetryCount < (errorHandlingConfig.retry_policy.max_attempts - 1)) {
        currentRetryCount++;
        await query('UPDATE tasks SET retry_count = $1 WHERE task_id = $2', [currentRetryCount, fullTask.task_id]);
        console.log(`Run ${runId}, Step ${displayStepName}: Failure attempt ${currentRetryCount + 1}/${errorHandlingConfig.retry_policy.max_attempts}. Retrying.`);
        if (currentStepDefinition.type === 'agent_execution') {
            executeAgent(currentStepDefinition.agent_core_logic_identifier, fullTask.input_data_json)
                .then(agentResult => processTaskCompletionAndContinueWorkflow(fullTask.task_id, agentResult.output || agentResult, null, 'completed', branchContext))
                .catch(async retryError => handleStepFailure(runId, run, currentStepDefinition, { ...fullTask, retry_count: currentRetryCount }, retryError, accumulatedContext, branchContext));
            return;
        } else if (currentStepDefinition.type === 'sub_workflow' || currentStepDefinition.type === 'external_api_call') {
            console.warn(`Run ${runId}, Step ${displayStepName}: Retrying ${currentStepDefinition.type} step automatically...`);
            return processWorkflowStep(runId, fullTask.task_id, fullTask.input_data_json, branchContext, currentStepDefinition.name);
        }
    } else if (errorHandlingConfig?.retry_policy && errorHandlingConfig.retry_policy.max_attempts > 1) {
         console.log(`Run ${runId}, Step ${displayStepName}: Max retry attempts (${errorHandlingConfig.retry_policy.max_attempts}) reached.`);
    }

    console.log(`Run ${runId}, Step ${displayStepName}: Executing on_failure action.`);
    const onFailure = errorHandlingConfig?.on_failure || { action: 'fail_workflow' } as OnFailureAction;
    const errorDetails = { message: error?.message || 'Step failed.', details: error?.toString(), step_name: displayStepName, retry_attempts_made: currentRetryCount };
    let stepOutputWithError: Record<string, any> = {};
    if (onFailure.error_output_namespace) stepOutputWithError[onFailure.error_output_namespace] = errorDetails;
    else stepOutputWithError.error = errorDetails;

    const taskFinalOutput = { ...(fullTask.input_data_json || {}), ...stepOutputWithError };
    await engineUpdateTaskStatus(fullTask.task_id, 'failed', taskFinalOutput);
    const nextWorkflowAccumulatedContext = mergeOutputs(accumulatedContext, stepOutputWithError, currentStepDefinition.output_namespace);

    switch (onFailure.action) {
        case 'fail_workflow': await updateWorkflowRunStatus(runId, 'failed', displayStepName, nextWorkflowAccumulatedContext); break;
        case 'transition_to_step':
            if (onFailure.next_step) {
                console.log(`Run ${runId}, Step ${displayStepName}: Transitioning on failure to ${onFailure.next_step}.`);
                await processWorkflowStep(runId, fullTask.task_id, stepOutputWithError, branchContext, onFailure.next_step);
            } else {
                console.error(`Run ${runId}, Step ${displayStepName}: on_failure 'transition_to_step' missing 'next_step'. Failing.`);
                await updateWorkflowRunStatus(runId, 'failed', displayStepName, nextWorkflowAccumulatedContext);
            }
            break;
        case 'continue_with_error':
            console.log(`Run ${runId}, Step ${displayStepName}: Continuing with error.`);
            await processWorkflowStep(runId, fullTask.task_id, stepOutputWithError, branchContext);
            break;
        case 'manual_intervention':
            console.log(`Run ${runId}, Step ${displayStepName}: Manual intervention required.`);
            await engineUpdateTaskStatus(fullTask.task_id, 'requires_escalation');
            await updateWorkflowRunStatus(runId, 'failed', displayStepName, { ...nextWorkflowAccumulatedContext }); // Consider a specific run status
            break;
        default:
            console.error(`Run ${runId}, Step ${displayStepName}: Unknown on_failure action. Failing.`);
            await updateWorkflowRunStatus(runId, 'failed', displayStepName, nextWorkflowAccumulatedContext);
            break;
    }
}
// --- END: Helper Function Definitions ---

export const startWorkflowRunSchema = z.object({
  triggering_data_json: z.record(z.any()).optional(),
  workflow_name: z.string().optional(),
  workflow_version: z.number().int().positive().optional(),
});
export type StartWorkflowRunInput = z.infer<typeof startWorkflowRunSchema>;

export const createWorkflowRun = async (workflowId: string, userId: string | null, inputData?: Record<string, any>) => {
  const result = await query(
    'INSERT INTO workflow_runs (workflow_id, triggering_user_id, triggering_data_json, status, current_step_name, active_parallel_branches) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [workflowId, userId, inputData || {}, 'pending', null, null]
  );
  const newRun = result.rows[0];
  await processWorkflowStep(newRun.run_id, newRun.run_id, inputData || {});
  return getWorkflowRunById(newRun.run_id);
};

export const getWorkflowRunById = async (runId: string) => {
  const result = await query(
    `SELECT wr.*, w.name as workflow_name, w.version as workflow_version
     FROM workflow_runs wr JOIN workflows w ON wr.workflow_id = w.workflow_id WHERE wr.run_id = $1`, [runId]
  );
  return result.rows[0] || null;
};

export const getAllWorkflowRuns = async (filters: {workflowId?: string, status?: string, userId?: string} = {}) => {
    let queryString = `SELECT wr.*, w.name as workflow_name, w.version as workflow_version FROM workflow_runs wr JOIN workflows w ON wr.workflow_id = w.workflow_id`;
    const conditions: string[] = []; const params: any[] = []; let paramIndex = 1;
    if (filters.workflowId) { conditions.push(`wr.workflow_id = $${paramIndex++}`); params.push(filters.workflowId); }
    if (filters.status) { conditions.push(`wr.status = $${paramIndex++}`); params.push(filters.status); }
    if (filters.userId) { conditions.push(`wr.triggering_user_id = $${paramIndex++}`); params.push(filters.userId); }
    if (conditions.length > 0) queryString += ' WHERE ' + conditions.join(' AND ');
    queryString += ' ORDER BY wr.start_time DESC';
    const result = await query(queryString, params);
    return result.rows;
};

export const updateWorkflowRunStatus = async (runId: string, status: string, currentStepName?: string | null, resultsJson?: Record<string, any> | null) => {
  const updates: Partial<any> = { status };
  if (currentStepName !== undefined) updates.current_step_name = currentStepName;
  if (resultsJson !== undefined) updates.results_json = resultsJson;
  if (status === 'completed' || status === 'failed' || status === 'cancelled') updates.end_time = new Date().toISOString();
  const fields = Object.keys(updates); const values = Object.values(updates);
  const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
  const queryString = `UPDATE workflow_runs SET ${setClauses} WHERE run_id = $1 RETURNING *`;
  const updatedRunResult = await query(queryString, [runId, ...values]);
  const updatedRun = updatedRunResult.rows[0];
  if (updatedRun && (updatedRun.status === 'completed' || updatedRun.status === 'failed')) {
    const parentTaskResult = await query(
        `SELECT task_id, run_id as parent_run_id FROM tasks WHERE sub_workflow_run_id = $1 AND status NOT IN ('completed', 'failed')`, [runId]
    );
    if (parentTaskResult.rows.length > 0) {
      const parentTask = parentTaskResult.rows[0];
      console.log(`Sub-workflow ${runId} finished (${updatedRun.status}). Resuming parent ${parentTask.parent_run_id}, task ${parentTask.task_id}.`);
      await processTaskCompletionAndContinueWorkflow(parentTask.task_id, updatedRun.results_json || { error: `Sub-workflow ${runId} ended ${updatedRun.status}` }, null, updatedRun.status as 'completed' | 'failed');
    }
  }
  return updatedRun;
};

export const processWorkflowStep = async (
    runId: string, triggeringTaskId: string | null, previousStepOutput?: Record<string, any> | null,
    branchContext?: { parallelStepName: string; branchName: string; joinStepName: string },
    forcedNextStepName?: string | null
): Promise<void> => {
  const run = await getWorkflowRunById(runId);
  if (!run || ['completed', 'failed', 'cancelled'].includes(run.status)) {
    console.log(`Workflow run ${runId} (Task: ${triggeringTaskId}) terminal/not found. No processing.`);
    return;
  }
  const workflowDefinition = await getWorkflowDefinitionById(run.workflow_id);
  if (!workflowDefinition || !workflowDefinition.definition_json) {
    await updateWorkflowRunStatus(runId, 'failed', run.current_step_name, { error: 'Workflow definition not found/invalid.' });
    return;
  }
  const definition = workflowDefinition.definition_json as any;
  let allStepsInWorkflow = definition.steps as Array<any>;
  let currentStepSet = allStepsInWorkflow;
  let actualCurrentStepNameForLookup = run.current_step_name;

  if (branchContext) {
    const parallelStepDef = allStepsInWorkflow.find(s => s.name === branchContext.parallelStepName && s.type === 'parallel');
    const branchDef = parallelStepDef?.branches?.find((b:any) => b.name === branchContext.branchName);
    if (!branchDef || !branchDef.steps) {
        await updateWorkflowRunStatus(runId, 'failed', run.current_step_name, { error: `Branch ${branchContext.branchName} not found.` });
        return;
    }
    currentStepSet = branchDef.steps;
  }

  let accumulatedContext = { ...(run.triggering_data_json || {}), ...(run.results_json || {}) };
  if (previousStepOutput && actualCurrentStepNameForLookup) {
      const prevStepDef = currentStepSet.find(s => s.name === actualCurrentStepNameForLookup);
      accumulatedContext = mergeOutputs(accumulatedContext, previousStepOutput, prevStepDef?.output_namespace);
  }

  let nextStepToExecuteName: string | null = null;
  if (forcedNextStepName !== undefined) nextStepToExecuteName = forcedNextStepName;
  else if (triggeringTaskId === runId && !actualCurrentStepNameForLookup) nextStepToExecuteName = definition.start_step;
  else if (actualCurrentStepNameForLookup) nextStepToExecuteName = getNextStepName(actualCurrentStepNameForLookup, currentStepSet, { output: previousStepOutput, workflowData: accumulatedContext });
  else {
      const errorMsg = `Run ${runId}: current_step_name null, not initial trigger, no forced next step. Anomaly.`;
      console.error(errorMsg);
      await updateWorkflowRunStatus(runId, 'failed', actualCurrentStepNameForLookup, { ...accumulatedContext, error: errorMsg });
      return;
  }

  if (nextStepToExecuteName === null) {
    if (branchContext) {
      console.log(`Branch ${branchContext.branchName} of ${branchContext.parallelStepName} completed. Output:`, previousStepOutput);
      await markBranchAsCompleted(runId, branchContext.parallelStepName, branchContext.branchName, accumulatedContext);
      await tryProcessJoinStep(runId, branchContext.parallelStepName, branchContext.joinStepName, allStepsInWorkflow);
    } else {
      await updateWorkflowRunStatus(runId, 'completed', actualCurrentStepNameForLookup, accumulatedContext);
      console.log(`Workflow run ${runId} completed.`);
    }
    return;
  }

  const stepSetForNextStepLookup = branchContext ? currentStepSet : allStepsInWorkflow;
  const currentStepDefinition = stepSetForNextStepLookup.find(s => s.name === nextStepToExecuteName);

  if (!currentStepDefinition) {
    const errorMsg = `Step definition for '${nextStepToExecuteName}' not found.`;
    await updateWorkflowRunStatus(runId, 'failed', nextStepToExecuteName, { ...accumulatedContext, error: errorMsg });
    return;
  }

  const displayStepNameForNextRun = branchContext ? `${branchContext.parallelStepName}.${branchContext.branchName}.${currentStepDefinition.name}` : currentStepDefinition.name;
  await updateWorkflowRunStatus(runId, 'in_progress', currentStepDefinition.name, accumulatedContext);
  console.log(`Run ${runId} moving to step: ${displayStepNameForNextRun}`);

  const taskData: TaskCreationData = {
      run_id: runId, step_name_in_workflow: currentStepDefinition.name, type: currentStepDefinition.type as any,
      input_data_json: { ...accumulatedContext, ...(currentStepDefinition.default_input || {}) },
  };

  if (currentStepDefinition.type === 'parallel') {
    console.log(`Processing PARALLEL step: ${currentStepDefinition.name} for run ${runId}`);
    const parallelBranches = currentStepDefinition.branches || [];
    if (parallelBranches.length === 0) {
        await updateWorkflowRunStatus(runId, 'failed', displayStepNameForNextRun, { error: `Parallel step ${currentStepDefinition.name} has no branches defined.`});
        return;
    }
    const initialBranchStates = parallelBranches.reduce((acc: any, branch: any) => { acc[branch.name] = { status: 'pending', output: null }; return acc; }, {});
    await updateRunActiveParallelBranches(runId, currentStepDefinition.name, initialBranchStates);
    for (const branch of parallelBranches) {
        const firstStepInBranch = branch.steps.find((s:any) => s.name === branch.start_step);
        if (!firstStepInBranch) {
            console.error(`Start step ${branch.start_step} in branch ${branch.name} of ${currentStepDefinition.name} not found. Skipping.`);
            await markBranchAsCompleted(runId, currentStepDefinition.name, branch.name, { error: `Start step ${branch.start_step} not found.` }, 'failed');
            continue;
        }
        console.log(`Starting branch: ${branch.name} of ${currentStepDefinition.name} for run ${runId}`);
        await processWorkflowStep(runId, null, accumulatedContext, {
            parallelStepName: currentStepDefinition.name, branchName: branch.name, joinStepName: currentStepDefinition.join_on
        });
    }
    return;
  } else if (currentStepDefinition.type === 'join') {
    console.log(`Reached JOIN step: ${currentStepDefinition.name} for run ${runId}. Waiting for branches.`);
    return;
  } else if (currentStepDefinition.type === 'agent_execution') {
      taskData.assigned_to_agent_id = currentStepDefinition.agent_core_logic_identifier;
      if (!taskData.assigned_to_agent_id) {
        const err = new Error(`Agent identifier missing for step ${currentStepDefinition.name}`);
        const tempTask = await createTask(taskData); // Create task to log failure against
        await handleStepFailure(runId, run, currentStepDefinition, tempTask, err, accumulatedContext, branchContext);
        return;
      }
      const newTask = await createTask(taskData);
      executeAgent(taskData.assigned_to_agent_id, newTask.input_data_json!) // input_data_json is set in taskData
        .then(agentResult => processTaskCompletionAndContinueWorkflow(newTask.task_id, agentResult.output || agentResult, null, 'completed', branchContext))
        .catch(async agentError => {
            console.error(`Run ${runId}, Step ${currentStepDefinition.name}: Agent execution failed. Initiating error handling.`, agentError);
            const currentTaskState = await getTaskById(newTask.task_id);
            await handleStepFailure(runId, run, currentStepDefinition, currentTaskState || newTask, agentError, accumulatedContext, branchContext);
        });
  } else if (['human_review', 'data_input', 'decision'].includes(currentStepDefinition.type)) {
      taskData.assigned_to_user_id = currentStepDefinition.assigned_to_user_id || null;
      taskData.assigned_to_role = currentStepDefinition.assigned_to_role || null;
      // Add deadline and escalation from definition to task data
      if (currentStepDefinition.deadline_minutes) taskData.deadline_minutes = currentStepDefinition.deadline_minutes;
      if (currentStepDefinition.escalation_policy) taskData.escalation_policy = currentStepDefinition.escalation_policy;
      await createTask(taskData);
      console.log(`Human task '${displayStepNameForNextRun}' created for run ${runId}.`);
  } else if (currentStepDefinition.type === 'sub_workflow') {
        console.log(`Processing SUB_WORKFLOW step: ${currentStepDefinition.name} for run ${runId}`);
        const { sub_workflow_name, sub_workflow_version, input_mapping } = currentStepDefinition;
        if (!sub_workflow_name) {
            const err = new Error(`Sub-workflow step "${currentStepDefinition.name}" is missing 'sub_workflow_name'.`);
            const tempTask = await createTask({...taskData, type: 'sub_workflow'});
            await handleStepFailure(runId, run, currentStepDefinition, tempTask, err, accumulatedContext, branchContext);
            return;
        }
        const subWorkflowDef = await getWorkflowDefinitionByNameAndVersion(sub_workflow_name, sub_workflow_version);
        if (!subWorkflowDef) {
            const err = new Error(`Sub-workflow definition "${sub_workflow_name}" (v: ${sub_workflow_version || 'latest'}) not found/active.`);
            const tempTask = await createTask({...taskData, type: 'sub_workflow'});
            await handleStepFailure(runId, run, currentStepDefinition, tempTask, err, accumulatedContext, branchContext);
            return;
        }
        let subWorkflowInputs = { ...accumulatedContext };
        if (input_mapping) {
            subWorkflowInputs = {};
            for (const key in input_mapping) {
                const value = getNestedValue(accumulatedContext, input_mapping[key]);
                if (value !== undefined) subWorkflowInputs[key] = value;
                else console.warn(`Input mapping for sub-workflow: key "${input_mapping[key]}" not found in parent context for step "${currentStepDefinition.name}".`);
            }
        }
        const parentSubWorkflowTask = await createTask({ ...taskData, type: 'sub_workflow' });
        try {
            const subRun = await createWorkflowRun(subWorkflowDef.workflow_id, run.triggering_user_id, subWorkflowInputs);
            await query('UPDATE tasks SET sub_workflow_run_id = $1 WHERE task_id = $2', [subRun.run_id, parentSubWorkflowTask.task_id]);
            console.log(`Sub-workflow ${sub_workflow_name} (Run ID: ${subRun.run_id}) started for task ${parentSubWorkflowTask.task_id}. Parent run ${runId} waiting.`);
        } catch (subRunError: any) {
            console.error(`Failed to start sub-workflow ${sub_workflow_name}:`, subRunError);
            const currentTaskStateSub = await getTaskById(parentSubWorkflowTask.task_id);
            await handleStepFailure(runId, run, currentStepDefinition, currentTaskStateSub || parentSubWorkflowTask, subRunError, accumulatedContext, branchContext);
        }
  } else if (currentStepDefinition.type === 'external_api_call') {
        console.log(`Processing EXTERNAL_API_CALL step: ${displayStepNameForNextRun} for run ${runId}`);
        const apiConfig = currentStepDefinition.external_api_call_config as ExternalApiCallStepConfig;
        if (!apiConfig) {
            const err = new Error("External API call configuration is missing.");
            const tempTask = await createTask({...taskData, type: 'agent_execution'}); // Log as agent_execution type
            return handleStepFailure(runId, run, currentStepDefinition, tempTask, err, accumulatedContext, branchContext);
        }
        const apiTask = await createTask({...taskData, type: 'agent_execution', input_data_json: { url_template: apiConfig.url_template, method: apiConfig.method }});
        try {
            const templateResolutionContext = { workflow: { run_id: run.run_id, workflow_id: run.workflow_id }, context: accumulatedContext };
            const secretsContext = process.env as Record<string, string | undefined>;
            const finalUrl = resolveTemplate(apiConfig.url_template, templateResolutionContext, secretsContext);
            const finalHeaders = resolveObjectTemplate(apiConfig.headers_template, templateResolutionContext, secretsContext);
            const finalQueryParams = resolveObjectTemplate(apiConfig.query_params_template, templateResolutionContext, secretsContext);
            const finalBody = resolveBodyTemplate(apiConfig.body_template, templateResolutionContext, secretsContext);
            await engineUpdateTaskStatus(apiTask.task_id, 'in_progress', { resolved_url: finalUrl, resolved_method: apiConfig.method, resolved_params: finalQueryParams });
            const response = await axios({
                method: apiConfig.method, url: finalUrl, headers: finalHeaders,
                params: finalQueryParams, data: finalBody,
                timeout: (apiConfig.timeout_seconds || 30) * 1000,
            });
            const successCriteria = apiConfig.success_criteria || { status_codes: [200, 201, 202, 204] };
            const isSuccess = successCriteria.status_codes!.includes(response.status);
            if (isSuccess) {
                let apiOutput: any = { status: response.status, headers: response.headers, data: response.data };
                return processTaskCompletionAndContinueWorkflow(apiTask.task_id, apiOutput, null, 'completed', branchContext);
            } else {
                const nonSuccessError = new Error(`External API call to ${finalUrl} returned ${response.status}, not in success codes.`);
                (nonSuccessError as any).response_data = { status: response.status, data: response.data, headers: response.headers };
                throw nonSuccessError;
            }
        } catch (error: any) {
            console.error(`Run ${runId}, Step ${displayStepNameForNextRun}: External API call failed.`, error);
            let errorToHandle = error;
            if (axios.isAxiosError(error) && error.response) {
                errorToHandle = new Error(`API call to ${apiConfig.url_template} failed with status ${error.response.status}.`);
                (errorToHandle as any).response_data = { status: error.response.status, data: error.response.data, headers: error.response.headers };
            } else if (axios.isAxiosError(error) && error.request) {
                errorToHandle = new Error(`API call to ${apiConfig.url_template} failed: No response (Network error).`);
            }
            const currentTaskState = await getTaskById(apiTask.task_id);
            await handleStepFailure(runId, run, currentStepDefinition, currentTaskState || apiTask, errorToHandle, accumulatedContext, branchContext);
        }
  } else if (currentStepDefinition.type === 'end') {
        console.log(`Processing END step: ${displayStepNameForNextRun} for run ${runId}`);
        const finalStatus = currentStepDefinition.final_status || 'completed';
        await updateWorkflowRunStatus(runId, finalStatus, displayStepNameForNextRun, accumulatedContext);
        console.log(`Workflow run ${runId} reached end state '${finalStatus}' at step ${displayStepNameForNextRun}.`);
  } else {
        const errorMsg = `Unknown step type '${currentStepDefinition.type}' for step ${currentStepDefinition.name}.`;
        console.error(`Run ${runId}: ${errorMsg}`);
        const taskDataForUnknown: TaskCreationData = {
            run_id: runId, step_name_in_workflow: currentStepDefinition.name, type: 'agent_execution',
            input_data_json: { error: "Unknown step type.", step_type: currentStepDefinition.type },
        };
        const unknownTask = await createTask(taskDataForUnknown);
        await handleStepFailure(runId, run, currentStepDefinition, unknownTask, new Error(errorMsg), accumulatedContext, branchContext);
    }
};

export const processTaskCompletionAndContinueWorkflow = async (
    taskId: string, outputData: Record<string, any>, completingUserId?: string | null,
    taskFinalStatus?: 'completed' | 'failed',
    branchContext?: { parallelStepName: string; branchName: string; joinStepName: string }
) => {
    let completedTask = await getTaskById(taskId);
    if (!completedTask) throw new Error(`Task ${taskId} not found.`);
    const statusToSet = taskFinalStatus || 'completed';
    completedTask = await completeTaskInService(taskId, outputData, completingUserId, statusToSet);
    if (!completedTask) throw new Error(`Task ${taskId} completion failed.`);

    if (completedTask.type === 'sub_workflow' && statusToSet === 'failed') {
        const run = await getWorkflowRunById(completedTask.run_id);
        if (!run) { console.error(`Run ${completedTask.run_id} not found for failed sub-workflow task ${taskId}.`); return completedTask; }
        const workflowDefinition = await getWorkflowDefinitionById(run.workflow_id);
        if (!workflowDefinition || !workflowDefinition.definition_json) {
            console.error(`Def ${run.workflow_id} not found for failed sub-workflow task ${taskId}.`);
            await updateWorkflowRunStatus(run.run_id, 'failed', completedTask.step_name_in_workflow, { error: `Def missing for failed sub-workflow task ${taskId}` });
            return completedTask;
        }
        const definition = workflowDefinition.definition_json as any;
        let stepSetForDefinitionLookup = definition.steps;
        if (branchContext) {
            const parallelStepDef = definition.steps.find((s:any) => s.name === branchContext.parallelStepName && s.type === 'parallel');
            const branchDef = parallelStepDef?.branches?.find((b:any) => b.name === branchContext.branchName);
            if (branchDef?.steps) stepSetForDefinitionLookup = branchDef.steps;
            else console.error(`Run ${run.run_id}: Branch def for ${JSON.stringify(branchContext)} not found.`);
        }
        const stepDef = stepSetForDefinitionLookup.find((s:any) => s.name === completedTask.step_name_in_workflow);
        if (stepDef) {
            const subWorkflowError = outputData.error || `Sub-workflow for ${stepDef.name} failed.`;
            await handleStepFailure(run.run_id, run, stepDef, completedTask, subWorkflowError, run.results_json || {}, branchContext); // Pass empty obj if results_json is null
            return completedTask;
        } else {
            console.error(`Run ${run.run_id}: Step def ${completedTask.step_name_in_workflow} not found for failed sub. Failing.`);
            await updateWorkflowRunStatus(run.run_id, 'failed', completedTask.step_name_in_workflow, { error: `Step def not found for failed sub ${completedTask.step_name_in_workflow}` });
            return completedTask;
        }
    }
    await processWorkflowStep(completedTask.run_id, completedTask.task_id, completedTask.output_data_json, branchContext);
    return completedTask;
};
