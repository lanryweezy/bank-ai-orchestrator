import { query } from '../config/db';
import { z } from 'zod';
import { getWorkflowDefinitionById } from './workflowService';
import { v4 as uuidv4 } from 'uuid';

// Enhanced Zod schema for input validation
export const startWorkflowRunSchema = z.object({
    workflowId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    inputData: z.record(z.any()).optional()
});

// Workflow context interface for advanced orchestration
interface WorkflowContext {
    run_id: string;
    workflow_id: string;
    current_data: Record<string, any>;
    step_results: Record<string, any>;
    parallel_branches: Record<string, any>;
    sub_workflow_results: Record<string, any>;
    variables: Record<string, any>;
    user_id?: string;
}

// Step execution result interface
interface StepExecutionResult {
    success: boolean;
    output_data?: Record<string, any>;
    next_step?: string;
    error_message?: string;
    requires_human_action?: boolean;
    task_id?: string;
    parallel_branches?: string[];
    sub_workflow_run_id?: string;
}

// Create a new workflow run with enhanced initialization
export const createWorkflowRun = async (workflowId: string, userId: string | null, inputData?: Record<string, any>) => {
    const client = await query('BEGIN', []);
    
    try {
        // Get workflow definition to initialize context
        const workflowDef = await getWorkflowDefinitionById(workflowId);
        if (!workflowDef) {
            throw new Error('Workflow definition not found');
        }

        const runId = uuidv4();
        const definition = typeof workflowDef.definition_json === 'string' 
            ? JSON.parse(workflowDef.definition_json) 
            : workflowDef.definition_json;

        // Initialize workflow context
        const initialContext: WorkflowContext = {
            run_id: runId,
            workflow_id: workflowId,
            current_data: inputData || {},
            step_results: {},
            parallel_branches: {},
            sub_workflow_results: {},
            variables: inputData || {},
            user_id: userId || undefined
        };

        // Create workflow run record
        const result = await query(
            `INSERT INTO workflow_runs (
                run_id, workflow_id, triggering_user_id, triggering_data_json, 
                status, current_step_name, context_json
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                runId, 
                workflowId, 
                userId, 
                inputData || {}, 
                'running', 
                definition.start_step,
                JSON.stringify(initialContext)
            ]
        );

        // Start workflow execution
        await processWorkflowStep(runId, definition.start_step, initialContext);

        await query('COMMIT', []);
        return result.rows[0];
        
    } catch (error) {
        await query('ROLLBACK', []);
        throw error;
    }
};

// Advanced workflow step processing with full orchestration
export const processWorkflowStep = async (
    runId: string, 
    stepName: string, 
    context: WorkflowContext
): Promise<StepExecutionResult> => {
    try {
        // Get workflow definition
        const workflowDef = await getWorkflowDefinitionById(context.workflow_id);
        if (!workflowDef) {
            throw new Error('Workflow definition not found');
        }

        const definition = typeof workflowDef.definition_json === 'string' 
            ? JSON.parse(workflowDef.definition_json) 
            : workflowDef.definition_json;

        // Find the current step
        const step = findStepInDefinition(definition, stepName);
        if (!step) {
            throw new Error(`Step '${stepName}' not found in workflow definition`);
        }

        // Update current step in database
        await updateWorkflowRunCurrentStep(runId, stepName);

        // Execute step based on type
        let stepResult: StepExecutionResult;
        
        switch (step.type) {
            case 'agent_execution':
                stepResult = await executeAgentStep(step, context);
                break;
            case 'human_review':
                stepResult = await executeHumanReviewStep(step, context);
                break;
            case 'data_input':
                stepResult = await executeDataInputStep(step, context);
                break;
            case 'decision':
                stepResult = await executeDecisionStep(step, context);
                break;
            case 'parallel':
                stepResult = await executeParallelStep(step, context, definition);
                break;
            case 'join':
                stepResult = await executeJoinStep(step, context);
                break;
            case 'sub_workflow':
                stepResult = await executeSubWorkflowStep(step, context);
                break;
            case 'end':
                stepResult = await executeEndStep(step, context);
                break;
            default:
                throw new Error(`Unsupported step type: ${step.type}`);
        }

        // Update context with step results
        context.step_results[stepName] = stepResult.output_data || {};
        
        // Merge output data into variables if output_namespace is specified
        if (step.output_namespace && stepResult.output_data) {
            context.variables[step.output_namespace] = stepResult.output_data;
        } else if (stepResult.output_data) {
            context.variables = { ...context.variables, ...stepResult.output_data };
        }

        // Update context in database
        await updateWorkflowRunContext(runId, context);

        // Determine next step if not explicitly set
        if (!stepResult.next_step && !stepResult.requires_human_action && step.type !== 'end') {
            stepResult.next_step = determineNextStep(step, stepResult.output_data || {}, context);
        }

        // Continue to next step if specified and no human action required
        if (stepResult.next_step && !stepResult.requires_human_action) {
            await processWorkflowStep(runId, stepResult.next_step, context);
        }

        // Update workflow status if completed
        if (step.type === 'end' || stepResult.next_step === 'end') {
            await updateWorkflowRunStatus(runId, 'completed', null, context.step_results);
        }

        return stepResult;

    } catch (error) {
        console.error(`Error processing workflow step ${stepName}:`, error);
        await updateWorkflowRunStatus(runId, 'failed', stepName, { error: error.message });
        throw error;
    }
};

// Find step in workflow definition (supports nested structures)
const findStepInDefinition = (definition: any, stepName: string): any => {
    // Check main steps
    if (definition.steps) {
        const step = definition.steps.find((s: any) => s.name === stepName);
        if (step) return step;
    }

    // Check parallel branches
    if (definition.steps) {
        for (const step of definition.steps) {
            if (step.branches) {
                for (const branch of step.branches) {
                    if (branch.steps) {
                        const foundStep = branch.steps.find((s: any) => s.name === stepName);
                        if (foundStep) return foundStep;
                    }
                }
            }
        }
    }

    return null;
};

// Execute agent step with AI processing
const executeAgentStep = async (step: any, context: WorkflowContext): Promise<StepExecutionResult> => {
    try {
        // Simulate agent execution (in real implementation, this would call actual AI agents)
        const agentInput = {
            ...context.current_data,
            ...context.variables,
            step_name: step.name,
            workflow_context: context
        };

        // For demo purposes, simulate AI agent processing
        const agentOutput = {
            processed: true,
            confidence_score: 0.95,
            result: `Agent ${step.agent_core_logic_identifier} processed successfully`,
            extracted_data: agentInput,
            timestamp: new Date().toISOString()
        };

        // Log agent execution
        await logStepExecution(context.run_id, step.name, 'agent_execution', agentInput, agentOutput);

        return {
            success: true,
            output_data: agentOutput,
            requires_human_action: false
        };

    } catch (error) {
        console.error('Agent execution error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Execute human review step
const executeHumanReviewStep = async (step: any, context: WorkflowContext): Promise<StepExecutionResult> => {
    try {
        // Create task for human review
        const taskId = uuidv4();
        
        await query(
            `INSERT INTO tasks (
                task_id, run_id, step_name, task_type, assigned_role, 
                input_data_json, form_schema_json, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                taskId,
                context.run_id,
                step.name,
                'human_review',
                step.assigned_role || 'bank_user',
                JSON.stringify({
                    ...context.current_data,
                    ...context.variables,
                    step_context: context.step_results
                }),
                JSON.stringify(step.form_schema || {}),
                'pending'
            ]
        );

        // Log task creation
        await logStepExecution(context.run_id, step.name, 'human_review', { task_created: true }, { task_id: taskId });

        return {
            success: true,
            requires_human_action: true,
            task_id: taskId,
            output_data: { task_id: taskId, requires_review: true }
        };

    } catch (error) {
        console.error('Human review step error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Execute data input step
const executeDataInputStep = async (step: any, context: WorkflowContext): Promise<StepExecutionResult> => {
    try {
        // Create task for data input
        const taskId = uuidv4();
        
        await query(
            `INSERT INTO tasks (
                task_id, run_id, step_name, task_type, assigned_role,
                input_data_json, form_schema_json, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                taskId,
                context.run_id,
                step.name,
                'data_input',
                step.assigned_role || 'bank_user',
                JSON.stringify({
                    ...context.current_data,
                    ...context.variables,
                    default_values: step.default_input || {}
                }),
                JSON.stringify(step.form_schema || {}),
                'pending'
            ]
        );

        return {
            success: true,
            requires_human_action: true,
            task_id: taskId,
            output_data: { task_id: taskId, requires_input: true }
        };

    } catch (error) {
        console.error('Data input step error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Execute decision step with complex condition evaluation
const executeDecisionStep = async (step: any, context: WorkflowContext): Promise<StepExecutionResult> => {
    try {
        // Evaluate decision conditions
        const evaluationContext = {
            ...context.variables,
            ...context.step_results,
            current_data: context.current_data
        };

        // If no transitions defined, create task for manual decision
        if (!step.transitions || step.transitions.length === 0) {
            const taskId = uuidv4();
            
            await query(
                `INSERT INTO tasks (
                    task_id, run_id, step_name, task_type, assigned_role,
                    input_data_json, form_schema_json, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    taskId,
                    context.run_id,
                    step.name,
                    'decision',
                    step.assigned_role || 'bank_user',
                    JSON.stringify(evaluationContext),
                    JSON.stringify(step.form_schema || {}),
                    'pending'
                ]
            );

            return {
                success: true,
                requires_human_action: true,
                task_id: taskId,
                output_data: { task_id: taskId, requires_decision: true }
            };
        }

        // Automatic decision based on conditions
        const nextStep = determineNextStep(step, evaluationContext, context);
        
        await logStepExecution(context.run_id, step.name, 'decision', evaluationContext, { next_step: nextStep });

        return {
            success: true,
            next_step: nextStep,
            output_data: { decision_made: true, next_step: nextStep },
            requires_human_action: false
        };

    } catch (error) {
        console.error('Decision step error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Execute parallel step to spawn multiple branches
const executeParallelStep = async (step: any, context: WorkflowContext, definition: any): Promise<StepExecutionResult> => {
    try {
        const branchResults: Record<string, any> = {};
        const branchPromises: Promise<any>[] = [];

        // Execute each branch in parallel
        for (const branch of step.branches || []) {
            const branchPromise = executeBranch(branch, context, definition);
            branchPromises.push(branchPromise);
        }

        // Wait for all branches to complete or reach join points
        const results = await Promise.allSettled(branchPromises);
        
        results.forEach((result, index) => {
            const branchName = step.branches[index].name;
            if (result.status === 'fulfilled') {
                branchResults[branchName] = result.value;
            } else {
                branchResults[branchName] = { error: result.reason?.message || 'Branch execution failed' };
            }
        });

        // Update parallel branches in context
        context.parallel_branches = { ...context.parallel_branches, ...branchResults };

        await logStepExecution(context.run_id, step.name, 'parallel', { branches: step.branches?.map((b: any) => b.name) }, branchResults);

        return {
            success: true,
            output_data: { parallel_results: branchResults },
            next_step: step.join_on, // Move to join step
            requires_human_action: false
        };

    } catch (error) {
        console.error('Parallel step error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Execute branch within parallel processing
const executeBranch = async (branch: any, context: WorkflowContext, definition: any): Promise<any> => {
    const branchContext = { ...context };
    let currentStep = branch.start_step;
    const branchResults: Record<string, any> = {};

    while (currentStep && currentStep !== 'join') {
        const stepResult = await processWorkflowStep(context.run_id, currentStep, branchContext);
        branchResults[currentStep] = stepResult.output_data;
        
        if (stepResult.requires_human_action) {
            // Branch paused for human action
            break;
        }
        
        currentStep = stepResult.next_step;
    }

    return branchResults;
};

// Execute join step to synchronize parallel branches
const executeJoinStep = async (step: any, context: WorkflowContext): Promise<StepExecutionResult> => {
    try {
        // Collect results from all parallel branches
        const joinResults = {
            parallel_branches: context.parallel_branches,
            synchronized_at: new Date().toISOString()
        };

        await logStepExecution(context.run_id, step.name, 'join', context.parallel_branches, joinResults);

        return {
            success: true,
            output_data: joinResults,
            requires_human_action: false
        };

    } catch (error) {
        console.error('Join step error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Execute sub-workflow step
const executeSubWorkflowStep = async (step: any, context: WorkflowContext): Promise<StepExecutionResult> => {
    try {
        // Get sub-workflow definition
        const subWorkflowName = step.sub_workflow_name;
        const subWorkflowVersion = step.sub_workflow_version;

        if (!subWorkflowName) {
            throw new Error('Sub-workflow name not specified');
        }

        // Find sub-workflow definition
        const subWorkflowResult = await query(
            'SELECT * FROM workflows WHERE name = $1 AND version = $2 AND status = $3',
            [subWorkflowName, subWorkflowVersion || 1, 'active']
        );

        if (subWorkflowResult.rows.length === 0) {
            throw new Error(`Sub-workflow '${subWorkflowName}' not found`);
        }

        const subWorkflowDef = subWorkflowResult.rows[0];

        // Prepare input data for sub-workflow
        let subWorkflowInput = { ...context.current_data };
        
        if (step.input_mapping) {
            subWorkflowInput = {};
            for (const [subVar, parentPath] of Object.entries(step.input_mapping)) {
                subWorkflowInput[subVar] = getValueFromPath(context, parentPath as string);
            }
        }

        // Create and execute sub-workflow
        const subWorkflowRun = await createWorkflowRun(
            subWorkflowDef.workflow_id,
            context.user_id || null,
            subWorkflowInput
        );

        // Store sub-workflow result in context
        context.sub_workflow_results[step.name] = {
            run_id: subWorkflowRun.run_id,
            status: subWorkflowRun.status,
            input_data: subWorkflowInput
        };

        await logStepExecution(context.run_id, step.name, 'sub_workflow', subWorkflowInput, {
            sub_workflow_run_id: subWorkflowRun.run_id
        });

        return {
            success: true,
            output_data: {
                sub_workflow_run_id: subWorkflowRun.run_id,
                sub_workflow_status: subWorkflowRun.status
            },
            sub_workflow_run_id: subWorkflowRun.run_id,
            requires_human_action: false
        };

    } catch (error) {
        console.error('Sub-workflow step error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Execute end step
const executeEndStep = async (step: any, context: WorkflowContext): Promise<StepExecutionResult> => {
    try {
        const finalResults = {
            final_status: step.final_status || 'completed',
            step_results: context.step_results,
            parallel_results: context.parallel_branches,
            sub_workflow_results: context.sub_workflow_results,
            completed_at: new Date().toISOString()
        };

        await logStepExecution(context.run_id, step.name, 'end', context, finalResults);

        return {
            success: true,
            output_data: finalResults,
            requires_human_action: false
        };

    } catch (error) {
        console.error('End step error:', error);
        return {
            success: false,
            error_message: error.message,
            requires_human_action: false
        };
    }
};

// Advanced condition evaluation engine
const evaluateCondition = (condition: any, data: any): boolean => {
    const { field, operator, value } = condition;
    
    if (!field || !operator) return true; // Always transition if no condition
    
    const fieldValue = getValueFromPath(data, field);
    
    switch (operator) {
        case '==':
            return fieldValue == value;
        case '!=':
            return fieldValue != value;
        case '>':
            return parseFloat(fieldValue) > parseFloat(value);
        case '<':
            return parseFloat(fieldValue) < parseFloat(value);
        case '>=':
            return parseFloat(fieldValue) >= parseFloat(value);
        case '<=':
            return parseFloat(fieldValue) <= parseFloat(value);
        case 'contains':
            return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        case 'not_contains':
            return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        case 'exists':
            return fieldValue !== undefined && fieldValue !== null;
        case 'not_exists':
            return fieldValue === undefined || fieldValue === null;
        default:
            return true;
    }
};

// Get value from nested object path
const getValueFromPath = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Determine next step based on transitions and conditions
const determineNextStep = (step: any, outputData: any, context: WorkflowContext): string | undefined => {
    if (!step.transitions || step.transitions.length === 0) {
        return undefined;
    }

    const evaluationContext = {
        ...outputData,
        ...context.variables,
        ...context.step_results
    };

    for (const transition of step.transitions) {
        if (transition.condition_type === 'always' || !transition.condition_type) {
            return transition.to;
        }
        
        if (transition.condition_type === 'on_output_value') {
            if (evaluateCondition(transition, evaluationContext)) {
                return transition.to;
            }
        }
    }

    // Return first transition as fallback
    return step.transitions[0]?.to;
};

// Log step execution for audit and debugging
const logStepExecution = async (
    runId: string, 
    stepName: string, 
    stepType: string, 
    inputData: any, 
    outputData: any
): Promise<void> => {
    try {
        await query(
            `INSERT INTO audit_log (
                table_name, record_id, operation, old_values, new_values
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
                'workflow_step_execution',
                runId,
                stepType,
                JSON.stringify({ step: stepName, input: inputData }),
                JSON.stringify({ step: stepName, output: outputData })
            ]
        );
    } catch (error) {
        console.error('Failed to log step execution:', error);
    }
};

// Update workflow run current step
const updateWorkflowRunCurrentStep = async (runId: string, stepName: string): Promise<void> => {
    await query(
        'UPDATE workflow_runs SET current_step_name = $1 WHERE run_id = $2',
        [stepName, runId]
    );
};

// Update workflow run context
const updateWorkflowRunContext = async (runId: string, context: WorkflowContext): Promise<void> => {
    await query(
        'UPDATE workflow_runs SET context_json = $1 WHERE run_id = $2',
        [JSON.stringify(context), runId]
    );
};

// Get workflow run by ID
export const getWorkflowRunById = async (runId: string) => {
    const result = await query(
        `SELECT wr.*, w.name as workflow_name, w.version as workflow_version 
         FROM workflow_runs wr 
         LEFT JOIN workflows w ON wr.workflow_id = w.workflow_id 
         WHERE wr.run_id = $1`,
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
export const updateWorkflowRunStatus = async (
    runId: string, 
    status: string, 
    currentStepName?: string | null, 
    resultsJson?: Record<string, any> | null
) => {
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
        `SELECT t.*, wr.workflow_id, w.name as workflow_name 
         FROM tasks t 
         LEFT JOIN workflow_runs wr ON t.run_id = wr.run_id 
         LEFT JOIN workflows w ON wr.workflow_id = w.workflow_id 
         WHERE t.task_id = $1`,
        [taskId]
    );
    return result.rows[0] || null;
};

// Process task completion and continue workflow
export const processTaskCompletionAndContinueWorkflow = async (
    taskId: string, 
    outputData: Record<string, any>, 
    completedByUserId: string
): Promise<void> => {
    const client = await query('BEGIN', []);
    
    try {
        // Get task details
        const task = await getTaskById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        // Update task status
        await query(
            'UPDATE tasks SET status = $1, output_data_json = $2, completed_by_user_id = $3, completed_at = CURRENT_TIMESTAMP WHERE task_id = $4',
            ['completed', JSON.stringify(outputData), completedByUserId, taskId]
        );

        // Get workflow run
        const workflowRun = await getWorkflowRunById(task.run_id);
        if (!workflowRun) {
            throw new Error('Workflow run not found');
        }

        // Parse context
        const context: WorkflowContext = workflowRun.context_json 
            ? JSON.parse(workflowRun.context_json)
            : {
                run_id: task.run_id,
                workflow_id: workflowRun.workflow_id,
                current_data: {},
                step_results: {},
                parallel_branches: {},
                sub_workflow_results: {},
                variables: {}
            };

        // Update context with task output
        context.step_results[task.step_name] = outputData;
        context.variables = { ...context.variables, ...outputData };

        // Continue workflow from current step
        await processWorkflowStep(task.run_id, task.step_name, context);

        await query('COMMIT', []);
        
    } catch (error) {
        await query('ROLLBACK', []);
        throw error;
    }
};
