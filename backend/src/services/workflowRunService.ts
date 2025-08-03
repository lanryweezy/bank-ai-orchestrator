import { query } from '../config/db';
import { z } from 'zod';
import { getWorkflowDefinitionById } from './workflowService';
import { v4 as uuidv4 } from 'uuid';

// Zod schema for input validation
export const startWorkflowRunSchema = z.object({
    workflowId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    inputData: z.record(z.any()).optional()
});

// Create a new workflow run
export const createWorkflowRun = async (workflowId: string, userId: string | null, inputData?: Record<string, any>) => {
    const runId = uuidv4();
    const result = await query(
        'INSERT INTO workflow_runs (run_id, workflow_id, triggering_user_id, triggering_data_json, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [runId, workflowId, userId, inputData || {}, 'pending']
    );
    return result.rows[0];
};

// Get workflow run by ID
export const getWorkflowRunById = async (runId: string) => {
    const result = await query(
        'SELECT wr.*, w.name as workflow_name, w.version as workflow_version FROM workflow_runs wr LEFT JOIN workflows w ON wr.workflow_id = w.workflow_id WHERE wr.run_id = $1',
        [runId]
    );
    return result.rows[0] || null;
};

// Get all workflow runs with optional filters
export const getAllWorkflowRuns = async (filters: {workflowId?: string, status?: string, userId?: string} = {}) => {
    let queryString = `
        SELECT wr.*, w.name as workflow_name, w.version as workflow_version 
        FROM workflow_runs wr 
        LEFT JOIN workflows w ON wr.workflow_id = w.workflow_id 
        WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.workflowId) {
        queryString += ` AND wr.workflow_id = $${paramIndex}`;
        params.push(filters.workflowId);
        paramIndex++;
    }

    if (filters.status) {
        queryString += ` AND wr.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
    }

    if (filters.userId) {
        queryString += ` AND wr.triggering_user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
    }

    queryString += ' ORDER BY wr.created_at DESC';

    const result = await query(queryString, params);
    return result.rows;
};

// Update workflow run status
export const updateWorkflowRunStatus = async (runId: string, status: string, currentStepName?: string | null, resultsJson?: Record<string, any> | null) => {
    const updateFields: string[] = ['status = $2'];
    const values: any[] = [runId, status];
    let paramIndex = 3;

    if (currentStepName !== undefined) {
        updateFields.push(`current_step_name = $${paramIndex}`);
        values.push(currentStepName);
        paramIndex++;
    }

    if (resultsJson !== undefined) {
        updateFields.push(`results_json = $${paramIndex}`);
        values.push(resultsJson);
        paramIndex++;
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        updateFields.push(`end_time = CURRENT_TIMESTAMP`);
    }

    const queryString = `UPDATE workflow_runs SET ${updateFields.join(', ')} WHERE run_id = $1 RETURNING *`;
    const result = await query(queryString, values);
    return result.rows[0];
};

// Get task by ID
export const getTaskById = async (taskId: string) => {
    const result = await query(
        'SELECT t.*, wr.workflow_id, w.name as workflow_name FROM tasks t LEFT JOIN workflow_runs wr ON t.run_id = wr.run_id LEFT JOIN workflows w ON wr.workflow_id = w.workflow_id WHERE t.task_id = $1',
        [taskId]
    );
    return result.rows[0] || null;
};

// Get tasks for a workflow run
export const getTasksForRun = async (runId: string) => {
    const result = await query(
        'SELECT * FROM tasks WHERE run_id = $1 ORDER BY created_at',
        [runId]
    );
    return result.rows;
};

// Create a new task
export const createTask = async (taskData: {
    runId: string;
    stepName: string;
    type: string;
    assignedToAgentId?: string;
    assignedToUserId?: string;
    assignedToRole?: string;
    inputData?: Record<string, any>;
    dueDate?: string;
}) => {
    const taskId = uuidv4();
    const result = await query(
        'INSERT INTO tasks (task_id, run_id, step_name_in_workflow, type, assigned_to_agent_id, assigned_to_user_id, assigned_to_role, input_data_json, due_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [
            taskId,
            taskData.runId,
            taskData.stepName,
            taskData.type,
            taskData.assignedToAgentId || null,
            taskData.assignedToUserId || null,
            taskData.assignedToRole || null,
            taskData.inputData || {},
            taskData.dueDate || null,
            'pending'
        ]
    );
    return result.rows[0];
};

// Update task status
export const updateTaskStatus = async (taskId: string, status: string, outputData?: Record<string, any>) => {
    const task = await getTaskById(taskId);
    if (!task) throw new Error('Task not found for status update.');

    const updates: any = { status };
    if (outputData) updates.output_data_json = outputData;

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
    const queryString = `UPDATE tasks SET ${setClauses} WHERE task_id = $1 RETURNING *`;

    const result = await query(queryString, [taskId, ...values]);
    return result.rows[0];
};

// Simplified workflow processing function
export const processWorkflowStep = async (
    runId: string,
    triggeringTaskId: string | null,
    previousStepOutput?: Record<string, any> | null
) => {
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

    const definition = workflowDefinition.definition_json as any;
    const steps = definition.steps as Array<any>;
    
    // Find current step or start step
    const currentStepName = run.current_step_name || definition.start_step;
    const currentStep = steps.find(step => step.name === currentStepName);
    
    if (!currentStep) {
        await updateWorkflowRunStatus(runId, 'failed', currentStepName, { error: `Step "${currentStepName}" not found in workflow definition.` });
        return;
    }

    console.log(`Processing step: ${currentStep.name} (type: ${currentStep.type}) for run ${runId}`);

    // Update status to in_progress
    await updateWorkflowRunStatus(runId, 'in_progress', currentStepName);

    // Handle different step types
    if (currentStep.type === 'agent_execution') {
        // Create agent task
        const task = await createTask({
            runId,
            stepName: currentStep.name,
            type: 'agent_execution',
            assignedToAgentId: currentStep.agent_id,
            inputData: previousStepOutput || currentStep.default_input || {}
        });
        console.log(`Created agent task ${task.task_id} for step ${currentStep.name}`);
        
    } else if (currentStep.type === 'human_review') {
        // Create human task
        const task = await createTask({
            runId,
            stepName: currentStep.name,
            type: 'human_review',
            assignedToUserId: currentStep.assigned_user_id,
            assignedToRole: currentStep.assigned_role,
            inputData: previousStepOutput || currentStep.default_input || {}
        });
        console.log(`Created human task ${task.task_id} for step ${currentStep.name}`);
        
    } else if (currentStep.type === 'end') {
        // End the workflow
        const finalStatus = currentStep.final_status || 'completed';
        await updateWorkflowRunStatus(runId, finalStatus, currentStep.name, previousStepOutput);
        console.log(`Workflow run ${runId} reached end state '${finalStatus}' at step ${currentStep.name}.`);
        
    } else {
        await updateWorkflowRunStatus(runId, 'failed', currentStep.name, { error: `Unknown task type '${currentStep.type}' for step ${currentStep.name}.` });
    }
};

// Process task completion and continue workflow
export const processTaskCompletionAndContinueWorkflow = async (
    taskId: string,
    outputData: Record<string, any>,
    completingUserId?: string | null
) => {
    const completedTask = await getTaskById(taskId);
    if (!completedTask) {
        throw new Error(`Task ${taskId} not found during completion process.`);
    }

    // Update task status to completed
    await updateTaskStatus(taskId, 'completed', outputData);

    // Get the workflow run
    const run = await getWorkflowRunById(completedTask.run_id);
    if (!run) {
        throw new Error(`Workflow run ${completedTask.run_id} not found.`);
    }

    // Get workflow definition to find next step
    const workflowDefinition = await getWorkflowDefinitionById(run.workflow_id);
    if (!workflowDefinition || !workflowDefinition.definition_json) {
        throw new Error(`Workflow definition not found for workflow ${run.workflow_id}.`);
    }

    const definition = workflowDefinition.definition_json as any;
    const steps = definition.steps as Array<any>;
    const currentStep = steps.find(step => step.name === completedTask.step_name_in_workflow);
    
    if (!currentStep || !currentStep.transitions || currentStep.transitions.length === 0) {
        // No transitions, end the workflow
        await updateWorkflowRunStatus(run.run_id, 'completed', completedTask.step_name_in_workflow, outputData);
        return;
    }

    // Find the first valid transition (simplified - should evaluate conditions)
    const nextTransition = currentStep.transitions[0];
    if (nextTransition && nextTransition.to) {
        // Update current step and continue processing
        await updateWorkflowRunStatus(run.run_id, 'in_progress', nextTransition.to, { ...run.results_json, [completedTask.step_name_in_workflow]: outputData });
        await processWorkflowStep(run.run_id, taskId, outputData);
    } else {
        // No valid transition found, end workflow
        await updateWorkflowRunStatus(run.run_id, 'completed', completedTask.step_name_in_workflow, outputData);
    }
};
