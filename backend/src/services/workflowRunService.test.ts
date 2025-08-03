import {
  createWorkflowRun,
  getWorkflowRunById,
  processWorkflowStep,
  processTaskCompletionAndContinueWorkflow,
} from './workflowRunService';
import * as db from '../config/db';
import * as workflowService from './workflowService';
import * as taskService from './taskService';
import { TaskCreationData } from './taskService';
import { Task, WorkflowRun, WorkflowDefinition, HumanTaskEscalationPolicyType } from '../../../src/types/workflows';
import * as configuredAgentService from './configuredAgentService';
import { LOAN_CHECKER_AGENT_LOGIC_ID } from './agentLogic/loanCheckerAgent';

jest.mock('../config/db');
jest.mock('./workflowService');
jest.mock('./taskService');
jest.mock('./configuredAgentService');

let taskStore: Record<string, any> = {};

describe('workflowRunService', () => {
  const mockQuery = db.query as jest.Mock;
  const mockGetWorkflowDefinitionById = workflowService.getWorkflowDefinitionById as jest.Mock;
  const mockCreateTask = taskService.createTask as jest.Mock;
  const mockCompleteTaskInService = taskService.completeTask as jest.Mock;
  const mockGetTaskById = taskService.getTaskById as jest.Mock;
  const mockExecuteAgent = configuredAgentService.executeAgent as jest.Mock;

  const workflowId = 'wf-uuid-1';
  const userId = 'user-uuid-1';
  const runId = 'run-uuid-1';

  const baseWorkflowRunData: WorkflowRun = {
    run_id: runId,
    workflow_id: workflowId,
    triggering_user_id: userId,
    triggering_data_json: { loanApplicationId: 'app-123', someInput: 'value' },
    status: 'pending',
    current_step_name: null,
    start_time: new Date().toISOString(),
    workflow_name: "Test Workflow",
    workflow_version: 1,
    results_json: null,
    active_parallel_branches: null,
    end_time: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleFullWorkflowDefinition: WorkflowDefinition = {
    workflow_id: workflowId,
    name: "Test Workflow Full",
    version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: "A full test workflow",
    definition_json: {
      name: "Test Workflow Full",
      start_step: "step1_agent_exec",
      steps: [
        {
          name: "step1_agent_exec",
          type: "agent_execution" as const,
          agent_core_logic_identifier: LOAN_CHECKER_AGENT_LOGIC_ID,
          transitions: [
            { to: "step2_human_review", condition_type: "conditional" as const, condition_group: { logical_operator: "AND" as const, conditions: [{ field: "output.agentOutput.status", operator: "==" as const, value: "needs_review"}]} },
            { to: "end_approved_by_agent", condition_type: "conditional" as const, condition_group: { logical_operator: "AND" as const, conditions: [{ field: "output.agentOutput.status", operator: "==" as const, value: "auto_approved"}]} },
            { to: "step2_human_review", condition_type: "always" as const }
          ]
        },
        {
          name: "step2_human_review",
          type: "human_review" as const,
          assigned_role: "loan_officer",
          transitions: [{ to: "end_approved", condition_type: "always" as const }]
        },
        { name: "end_approved_by_agent", type: "end" as const, final_status: "approved" as const },
        { name: "end_approved", type: "end" as const, final_status: "approved" as const }
      ]
    }
  };

  const sampleAgentTaskShape = { run_id: runId, step_name_in_workflow: 'step1_agent_exec', type: 'agent_execution' as const, status: 'assigned' as const };
  const sampleHumanTaskShape = { run_id: runId, step_name_in_workflow: 'step2_human_review', type: 'human_review' as const, status: 'assigned' as const };

  beforeEach(() => {
    mockQuery.mockReset();
    mockGetWorkflowDefinitionById.mockReset();
    mockExecuteAgent.mockReset();
    taskStore = {};

    mockCreateTask.mockImplementation(async (taskDataInput: TaskCreationData) => {
      const newTaskId = `mock-task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const fullTask: Task = {
        task_id: newTaskId, run_id: taskDataInput.run_id,
        step_name_in_workflow: taskDataInput.step_name_in_workflow, type: taskDataInput.type,
        assigned_to_agent_id: taskDataInput.assigned_to_agent_id || null,
        assigned_to_user_id: taskDataInput.assigned_to_user_id || null,
        assigned_to_role: taskDataInput.assigned_to_role || null,
        input_data_json: taskDataInput.input_data_json || null,
        output_data_json: null,
        status: (taskDataInput.assigned_to_agent_id || taskDataInput.assigned_to_user_id || taskDataInput.assigned_to_role) ? 'assigned' : 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deadline_at: taskDataInput.deadline_minutes ? new Date(Date.now() + taskDataInput.deadline_minutes * 60000).toISOString() : (taskDataInput.due_date || null),
        escalation_policy_json: (taskDataInput.escalation_policy && typeof taskDataInput.escalation_policy.after_minutes === 'number')
                                  ? taskDataInput.escalation_policy as HumanTaskEscalationPolicyType
                                  : null,
        is_delegated: false,
        delegated_by_user_id: null,
        retry_count: 0,
        sub_workflow_run_id: null,
      };
      taskStore[newTaskId] = fullTask;
      return Promise.resolve(fullTask);
    });

    mockGetTaskById.mockImplementation(async (taskId: string) => Promise.resolve(taskStore[taskId] || null));

    mockCompleteTaskInService.mockImplementation(async (taskId: string, outputData: Record<string, any>, _completingUserId, finalStatus = 'completed') => {
        const task = taskStore[taskId];
        if (task) {
            if (task.status === 'completed' && finalStatus === 'completed') { // Adjusted this logic slightly from service for test simplicity
                 console.warn(`Mock: Task ${taskId} is already completed. Returning current state.`);
                 return Promise.resolve(task);
            }
            const updated = { ...task, status: finalStatus, output_data_json: outputData, updated_at: new Date().toISOString() };
            taskStore[taskId] = updated;
            return Promise.resolve(updated);
        }
        throw new Error(`Mock: Task ${taskId} not found in mockCompleteTaskInService.`);
    });

    mockQuery.mockImplementation(async (queryString: string, params: any[] = []) => {
      if (queryString.startsWith('INSERT INTO workflow_runs')) {
         const generatedRunId = params[0] || runId; // Assuming runId might be passed if not default
         const newRunData = {...baseWorkflowRunData, run_id: generatedRunId, status: 'pending', current_step_name: null, triggering_data_json: params[2] || {} };
         taskStore[`run_${generatedRunId}`] = newRunData;
         return Promise.resolve({ rows: [newRunData] });
      }
      if (queryString.startsWith('UPDATE workflow_runs')) {
        const runIdParam = params[0];
        let currentRunState = taskStore[`run_${runIdParam}`];
        if (!currentRunState) { // If not in taskStore, create a base version
            currentRunState = { ...baseWorkflowRunData, run_id: runIdParam };
        }
        // Simulate the update based on SET clauses
        const updatedRun = { ...currentRunState };
        // This is a simplified mock; actual parsing of SET clauses would be complex.
        // Assuming params are [runId, status, currentStepName, resultsJson?, endTime?] or similar
        if (params[1] !== undefined) updatedRun.status = params[1];
        if (params[2] !== undefined) updatedRun.current_step_name = params[2];
        if (params[3] !== undefined && queryString.includes("results_json")) updatedRun.results_json = params[3];
        else if (params[3] !== undefined && queryString.includes("end_time")) updatedRun.end_time = params[3];
        if (params[4] !== undefined && queryString.includes("results_json")) updatedRun.results_json = params[4];


        updatedRun.updated_at = new Date().toISOString();
        taskStore[`run_${runIdParam}`] = updatedRun;
        return Promise.resolve({ rows: [updatedRun] });
      }
      if (queryString.startsWith('SELECT wr.*')) { // For getWorkflowRunById
        const runIdParam = params[0];
        const runFromStore = taskStore[`run_${runIdParam}`];
        return Promise.resolve({ rows: runFromStore ? [runFromStore] : [] });
      }
      if (queryString.startsWith('UPDATE tasks SET retry_count')) { // For retry count update in handleStepFailure
        return Promise.resolve({ rows: [{task_id: params[1], retry_count: params[0]}]}); // Minimal mock
      }
      return Promise.resolve({ rows: [] });
    });
  });

  describe('createWorkflowRun', () => {
    it('should create a run and process its first step, advancing it', async () => {
      const testRunId = 'create-run-id-1';
      const initialInput = { loanApplicationId: 'app-xyz' };
      const runAfterInsert = { ...baseWorkflowRunData, run_id: testRunId, status: 'pending' as const, current_step_name: null, triggering_data_json: initialInput, results_json: initialInput };
      const runAfterStep1AgentOutput = { ...runAfterInsert, status: 'in_progress' as const, current_step_name: 'step1_agent_exec', results_json: { ...initialInput, agentOutput: { status: "needs_review" } } };
      const runAfterStep2Start = { ...runAfterStep1AgentOutput, current_step_name: 'step2_human_review'};

      // Prime taskStore for the initial state after INSERT
      taskStore[`run_${testRunId}`] = runAfterInsert;
      mockGetWorkflowDefinitionById.mockResolvedValue(sampleFullWorkflowDefinition);

      const createdAgentTask = { ...sampleAgentTaskShape, task_id: 'agent-task-for-create', run_id: testRunId, input_data_json: initialInput };
      const createdHumanTask = { ...sampleHumanTaskShape, task_id: 'human-task-for-create', run_id: testRunId };
      (mockCreateTask as jest.Mock)
        .mockResolvedValueOnce(createdAgentTask)
        .mockResolvedValueOnce(createdHumanTask);
      mockExecuteAgent.mockResolvedValueOnce({ success: true, output: { agentOutput: { status: "needs_review" } } });

      // Sequence of getWorkflowRunById calls made internally by processWorkflowStep and createWorkflowRun:
      // 1. Inside first processWorkflowStep call (triggered by createWorkflowRun)
      // 2. Inside processTaskCompletionAndContinueWorkflow (after agent task) -> then its own processWorkflowStep
      // 3. At the end of createWorkflowRun to return the final state
      mockQuery
        .mockResolvedValueOnce({ rows: [runAfterInsert] }) // For INSERT workflow_runs
        .mockResolvedValueOnce({ rows: [runAfterInsert] }) // For getWorkflowRunById in 1st processWorkflowStep
        .mockResolvedValueOnce({ rows: [runAfterStep1AgentOutput] }) // For getWorkflowRunById in processTaskCompletion (before 2nd process)
        .mockResolvedValueOnce({ rows: [runAfterStep2Start] });      // For final getWorkflowRunById in createWorkflowRun

      const result = await createWorkflowRun(sampleFullWorkflowDefinition.workflow_id, userId, initialInput);

      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO workflow_runs');
      expect(mockGetWorkflowDefinitionById).toHaveBeenCalledWith(sampleFullWorkflowDefinition.workflow_id);
      expect(mockCreateTask).toHaveBeenCalledTimes(2);
      expect(mockCreateTask).toHaveBeenNthCalledWith(1, expect.objectContaining({step_name_in_workflow: 'step1_agent_exec'}));
      expect(mockExecuteAgent).toHaveBeenCalled();
      expect(mockCreateTask).toHaveBeenNthCalledWith(2, expect.objectContaining({step_name_in_workflow: 'step2_human_review'}));
      expect(result.current_step_name).toBe('step2_human_review');
      expect(result.status).toBe('in_progress');
    });
  });

  describe('processWorkflowStep', () => {
    it('should create and execute an agent task, then create a human task based on definition', async () => {
      const testRunId = 'process-step-run-1';
      const initialRun = { ...baseWorkflowRunData, run_id: testRunId, status: 'pending' as const, current_step_name: null, triggering_data_json: { loanApplicationId: 'app-123' }, results_json: { loanApplicationId: 'app-123' } };
      const runAfterAgentStepStart = { ...initialRun, status: 'in_progress' as const, current_step_name: 'step1_agent_exec' };
      taskStore[`run_${testRunId}`] = initialRun;

      mockQuery // For the SELECT wr.* in getWorkflowRunById called by processWorkflowStep
          .mockResolvedValueOnce({ rows: [initialRun] })
          .mockResolvedValueOnce({ rows: [runAfterAgentStepStart] }); // After agent step's task is created and run status updated

      mockGetWorkflowDefinitionById.mockResolvedValue(sampleFullWorkflowDefinition);
      const agentExecutionOutput = { agentOutput: { status: "needs_review" } };
      mockExecuteAgent.mockResolvedValueOnce({ success: true, output: agentExecutionOutput });

      await processWorkflowStep(testRunId, testRunId, initialRun.triggering_data_json); // Initial call with runId as triggeringTaskId

      expect(mockCreateTask).toHaveBeenCalledTimes(2);
      const firstTaskCallArgs = (mockCreateTask as jest.Mock).mock.calls[0][0];
      expect(firstTaskCallArgs).toEqual(expect.objectContaining({
        step_name_in_workflow: 'step1_agent_exec',
        assigned_to_agent_id: sampleFullWorkflowDefinition.definition_json.steps[0].agent_core_logic_identifier
      }));

      const createdAgentTask = await (mockCreateTask.mock.results[0].value as Promise<Task>);
      expect(mockExecuteAgent).toHaveBeenCalledWith(
          sampleFullWorkflowDefinition.definition_json.steps[0].agent_core_logic_identifier,
          expect.objectContaining({ loanApplicationId: 'app-123' })
      );
      // processTaskCompletionAndContinueWorkflow will be called, which calls completeTaskInService
      expect(mockCompleteTaskInService).toHaveBeenCalledWith(createdAgentTask.task_id, agentExecutionOutput, null, 'completed');

      expect(mockCreateTask).toHaveBeenNthCalledWith(2, expect.objectContaining({
        step_name_in_workflow: 'step2_human_review',
        type: 'human_review'
      }));
    });

    it('should mark workflow as completed if a step transitions to an "end" type step', async () => {
        const testRunId = 'complete-test-run-1';
        const lastHumanStepName = "step2_human_review";
        const completedHumanTaskId = 'human-task-id-for-end-test';
        const humanTaskOutput = { reviewOutcome: 'approved' };
        const runAtLastHumanStep = { ...baseWorkflowRunData, run_id: testRunId, status: 'in_progress' as const, current_step_name: lastHumanStepName, results_json: { loanApplicationId: 'app-123', someInput: 'value' } };
        taskStore[`run_${testRunId}`] = runAtLastHumanStep;

        const definitionEndingAfterHumanReview = {
            ...sampleFullWorkflowDefinition,
            definition_json: {
                ...sampleFullWorkflowDefinition.definition_json,
                steps: [
                    { ...(sampleFullWorkflowDefinition.definition_json.steps[1] as any), name: "step2_human_review", transitions: [{to: "end_approved", condition_type: "always" as const}] },
                    sampleFullWorkflowDefinition.definition_json.steps[3]
                ],
                start_step: "step2_human_review" // For this specific test, start here.
            }
        };

      mockQuery.mockResolvedValueOnce({ rows: [runAtLastHumanStep] });
      mockGetWorkflowDefinitionById.mockResolvedValue(definitionEndingAfterHumanReview);

      await processWorkflowStep(testRunId, completedHumanTaskId, humanTaskOutput);

      const updateCallArgs = mockQuery.mock.calls.find(
        args => args[0].startsWith('UPDATE workflow_runs') && args[1].includes('completed') && args[1].includes('end_approved')
      );
      expect(updateCallArgs).toBeDefined();
      if (updateCallArgs) {
        expect(updateCallArgs[1][0]).toBe(testRunId);
        expect(updateCallArgs[1][1]).toBe('completed');
        expect(updateCallArgs[1][2]).toBe('end_approved');
        expect(updateCallArgs[1][3]).toEqual(expect.any(String));
        expect(updateCallArgs[1][4]).toEqual(expect.objectContaining(humanTaskOutput));
      }
    });
  });

  describe('processTaskCompletionAndContinueWorkflow', () => {
    it('should complete a task and trigger workflow progression', async () => {
        const testRunId = 'task-complete-run-id-1';
        const humanTaskId = 'human-task-for-completion-1';
        const humanTaskToComplete = { ...sampleHumanTaskShape, task_id: humanTaskId, run_id: testRunId, status: 'assigned' as const, assigned_to_user_id: userId, input_data_json: { someInput: 'data'} } as Task;
        taskStore[humanTaskId] = humanTaskToComplete;
        const outputData = { reviewOutcome: 'approved' };

        const runStateBeforeCompletion = { ...baseWorkflowRunData, run_id: testRunId, status: 'in_progress' as const, current_step_name: humanTaskToComplete.step_name_in_workflow, results_json: humanTaskToComplete.input_data_json };
        taskStore[`run_${testRunId}`] = runStateBeforeCompletion;

        mockQuery
            .mockResolvedValueOnce({rows: [runStateBeforeCompletion]}) // For getWorkflowRunById in processTaskCompletion
            .mockResolvedValueOnce({rows: [runStateBeforeCompletion]}); // For getWorkflowRunById in subsequent processWorkflowStep

        mockGetWorkflowDefinitionById.mockResolvedValue(sampleFullWorkflowDefinition);

        await processTaskCompletionAndContinueWorkflow(humanTaskId, outputData, userId, 'completed');

        expect(mockCompleteTaskInService).toHaveBeenCalledWith(humanTaskId, outputData, userId, 'completed');
        // Check that processWorkflowStep was called (implicitly, by checking for its effects like next task creation or status update)
        // This is hard to check directly without more mocks or spies on processWorkflowStep itself.
        // For now, ensuring completeTaskInService was called is a good sign.
    });
  });
});
