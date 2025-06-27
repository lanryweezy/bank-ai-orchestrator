import {
  createWorkflowRun,
  getWorkflowRunById,
  // getAllWorkflowRuns, // Not directly tested here, covered by API tests
  // updateWorkflowRunStatus, // Tested via processWorkflowStep
  processWorkflowStep,
  processTaskCompletionAndContinueWorkflow,
  // startWorkflowRunSchema // Schema, not a function to test directly here
} from './workflowRunService';
import * as db from '../config/db';
import * as workflowService from './workflowService';
import * as taskService from './taskService';
import { TaskCreationData } from './taskService';
import { Task, WorkflowRun, WorkflowDefinition } from '../types/workflows'; // Reverting to relative path
import * as configuredAgentService from './configuredAgentService';
import { LOAN_CHECKER_AGENT_LOGIC_ID } from './agentLogic/loanCheckerAgent';

jest.mock('../config/db');
jest.mock('./workflowService');
jest.mock('./taskService');
jest.mock('./configuredAgentService');

// In-memory store for tasks created during tests for this suite
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
  const runId = 'run-uuid-1'; // Default runId

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
    end_time: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // A more complete sample definition for complex tests
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
          type: "agent_execution",
          agent_id: "configured-agent-for-loan-checker",
          agent_core_logic_identifier: LOAN_CHECKER_AGENT_LOGIC_ID,
          transitions: [
            { to: "step2_human_review", condition_type: "on_output_value", field: "agentOutput.status", operator: "==", value: "needs_review"},
            { to: "end_approved_by_agent", condition_type: "on_output_value", field: "agentOutput.status", operator: "==", value: "auto_approved"},
            { to: "step2_human_review", condition_type: "always" } // Fallback
          ]
        },
        {
          name: "step2_human_review",
          type: "human_review",
          assigned_role: "loan_officer",
          transitions: [{ to: "end_approved", condition_type: "always" }]
        },
        { name: "end_approved_by_agent", type: "end", final_status: "approved" },
        { name: "end_approved", type: "end", final_status: "approved" }
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
        due_date: taskDataInput.due_date || null,
        status: (taskDataInput.assigned_to_agent_id || taskDataInput.assigned_to_user_id || taskDataInput.assigned_to_role) ? 'assigned' : 'pending',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), output_data_json: null,
      };
      taskStore[newTaskId] = fullTask;
      return Promise.resolve(fullTask);
    });

    mockGetTaskById.mockImplementation(async (taskId: string) => Promise.resolve(taskStore[taskId] || null));

    mockCompleteTaskInService.mockImplementation(async (taskId: string, outputData: Record<string, any>) => {
        const task = taskStore[taskId];
        if (task) {
            if (task.status === 'completed') throw new Error("Task is already completed.");
            const updated = { ...task, status: 'completed' as const, output_data_json: outputData, updated_at: new Date().toISOString() };
            taskStore[taskId] = updated;
            return Promise.resolve(updated);
        }
        throw new Error("Task not found in mockCompleteTaskInService.");
    });

    mockQuery.mockImplementation(async (queryString: string, params: any[] = []) => {
      if (queryString.startsWith('INSERT INTO workflow_runs')) {
         return Promise.resolve({ rows: [{...baseWorkflowRunData, run_id: params[0] || runId, status: 'pending', current_step_name: null }] });
      }
      if (queryString.startsWith('UPDATE workflow_runs')) {
        const runIdParam = params[0];
        const statusParam = params[1];
        const stepNameParam = params[2];
        const currentRunState = taskStore[`run_${runIdParam}`] || { ...baseWorkflowRunData, run_id: runIdParam };
        const updatedRun = { ...currentRunState, status: statusParam, current_step_name: stepNameParam, updated_at: new Date().toISOString() } as WorkflowRun;
        if (params.length > 3 && params[3] !== undefined) updatedRun.end_time = params[3];
        if (params.length > 4 && params[4] !== undefined) updatedRun.results_json = params[4];
        taskStore[`run_${runIdParam}`] = updatedRun; // Store updated run state for getWorkflowRunById
        return Promise.resolve({ rows: [updatedRun] });
      }
      if (queryString.startsWith('SELECT wr.*')) {
        return Promise.resolve({ rows: [taskStore[`run_${params[0]}`] || {...baseWorkflowRunData, run_id: params[0] || runId }] });
      }
      if (queryString.startsWith('UPDATE tasks')) {
        const taskIdParam = params[0];
        const taskFromStore = taskStore[taskIdParam];
        if(taskFromStore) {
            const updatedTask = {...taskFromStore, status: params[1], output_data_json: params[2], updated_at: new Date().toISOString() };
            taskStore[taskIdParam] = updatedTask;
            return Promise.resolve({rows: [updatedTask]});
        }
        return Promise.resolve({rows: []});
      }
      return Promise.resolve({ rows: [] });
    });
  });

  describe('createWorkflowRun', () => {
    it('should create a run and process its first step, advancing it', async () => {
      const testRunId = 'create-run-id-1';
      const initialInput = { loanApplicationId: 'app-xyz' };

      // Simulate states
      const runAfterInsert = { ...baseWorkflowRunData, run_id: testRunId, status: 'pending' as const, current_step_name: null, triggering_data_json: initialInput };
      const runAfterStep1Start = { ...runAfterInsert, status: 'in_progress' as const, current_step_name: 'step1_agent_exec' };
      const runAfterStep1AgentOutput = { ...runAfterStep1Start };
      const runAfterStep2Start = { ...runAfterStep1AgentOutput, current_step_name: 'step2_human_review'};
      taskStore[`run_${testRunId}`] = runAfterInsert; // Prime taskStore for getWorkflowRunById

      mockGetWorkflowDefinitionById.mockResolvedValue(sampleFullWorkflowDefinition);

      const createdAgentTask = { ...sampleAgentTaskShape, task_id: 'agent-task-for-create', run_id: testRunId };
      const createdHumanTask = { ...sampleHumanTaskShape, task_id: 'human-task-for-create', run_id: testRunId };
      (mockCreateTask as jest.Mock)
        .mockResolvedValueOnce(createdAgentTask)
        .mockResolvedValueOnce(createdHumanTask);

      mockExecuteAgent.mockResolvedValueOnce({ success: true, output: { agentOutput: { status: "needs_review" } } });
      // mockCompleteTaskInService uses taskStore

      // Control getWorkflowRunById calls from processWorkflowStep
      (getWorkflowRunById as jest.Mock)
        .mockResolvedValueOnce(runAfterInsert)           // For first processWorkflowStep call
        .mockResolvedValueOnce(runAfterStep1AgentOutput) // For recursive processWorkflowStep call
        .mockResolvedValueOnce(runAfterStep2Start);      // For final getWorkflowRunById in createWorkflowRun

      const result = await createWorkflowRun(sampleFullWorkflowDefinition.workflow_id, userId, initialInput);

      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO workflow_runs'); // The actual insert
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
      const initialRun = { ...baseWorkflowRunData, run_id: testRunId, status: 'pending' as const, current_step_name: null, triggering_data_json: { loanApplicationId: 'app-123' } };
      const runAfterAgentStepStart = { ...initialRun, status: 'in_progress' as const, current_step_name: 'step1_agent_exec' };
      taskStore[`run_${testRunId}`] = initialRun; // Prime taskStore

      (getWorkflowRunById as jest.Mock)
        .mockResolvedValueOnce(initialRun)
        .mockResolvedValueOnce(runAfterAgentStepStart);

      mockGetWorkflowDefinitionById.mockResolvedValue(sampleFullWorkflowDefinition);

      const agentExecutionOutput = { agentOutput: { status: "needs_review" } }; // Matches transition condition
      mockExecuteAgent.mockResolvedValueOnce({ success: true, output: agentExecutionOutput });

      await processWorkflowStep(testRunId, null);

      expect(mockCreateTask).toHaveBeenCalledTimes(2); // Agent task, then human task
      const firstTaskCallArgs = (mockCreateTask as jest.Mock).mock.calls[0][0];
      expect(firstTaskCallArgs).toEqual(expect.objectContaining({
        step_name_in_workflow: 'step1_agent_exec',
        assigned_to_agent_id: sampleFullWorkflowDefinition.definition_json.steps[0].agent_id
      }));

      const createdAgentTask = await (mockCreateTask.mock.results[0].value as Promise<Task>);
      expect(mockExecuteAgent).toHaveBeenCalledWith(
          sampleFullWorkflowDefinition.definition_json.steps[0].agent_id,
          expect.objectContaining({ loanApplicationId: 'app-123' })
      );
      expect(mockCompleteTaskInService).toHaveBeenCalledWith(createdAgentTask.task_id, agentExecutionOutput);

      expect(mockCreateTask).toHaveBeenNthCalledWith(2, expect.objectContaining({
        step_name_in_workflow: 'step2_human_review',
        type: 'human_review'
      }));
    });

    it('should mark workflow as completed if a step transitions to an "end" type step', async () => {
        const testRunId = 'complete-test-run-1';
        const lastHumanStepName = "step2_human_review";
        const runAtLastHumanStep = { ...baseWorkflowRunData, run_id: testRunId, status: 'in_progress' as const, current_step_name: lastHumanStepName };
        taskStore[`run_${testRunId}`] = runAtLastHumanStep;

        const definitionEndingAfterHumanReview = {
            ...sampleFullWorkflowDefinition,
            definition_json: {
                ...sampleFullWorkflowDefinition.definition_json,
                steps: [
                    { ...sampleFullWorkflowDefinition.definition_json.steps[1], name: "step2_human_review", transitions: [{to: "end_approved", condition_type: "always" as const}] },
                    sampleFullWorkflowDefinition.definition_json.steps[3] // end_approved step
                ],
                start_step: "step2_human_review"
            }
        };

      (getWorkflowRunById as jest.Mock).mockResolvedValueOnce(runAtLastHumanStep);
      mockGetWorkflowDefinitionById.mockResolvedValue(definitionEndingAfterHumanReview); // Corrected variable name

      const humanTaskOutput = { reviewOutcome: 'approved' }; // This is previousTaskOutput

      await processWorkflowStep(testRunId, humanTaskOutput);

      const finalUpdateCall = mockQuery.mock.calls.find(call => call[0].startsWith('UPDATE workflow_runs') && call[1][1] === 'approved');
      expect(finalUpdateCall).toBeDefined();
      expect(finalUpdateCall[1]).toEqual(expect.arrayContaining([
          testRunId, // run_id = $1
          'approved', // status = $2
          'end_approved', // current_step_name = $3
          expect.any(String), // end_time = $4
          humanTaskOutput // results_json = $5
      ]));
    });
  });

  describe('processTaskCompletionAndContinueWorkflow', () => {
    it('should complete a task and trigger workflow progression', async () => {
        const testRunId = 'task-complete-run-id-1';
        const humanTaskId = 'human-task-for-completion-1';
        const humanTaskToComplete: Task = { ...sampleHumanTaskShape, task_id: humanTaskId, run_id: testRunId, status: 'assigned' as const, assigned_to_user_id: userId } as Task;
        taskStore[humanTaskId] = humanTaskToComplete;

        const outputData = { reviewOutcome: 'approved' };

        const runAfterTaskCompletion = { ...baseWorkflowRunData, run_id: testRunId, status: 'in_progress' as const, current_step_name: humanTaskToComplete.step_name_in_workflow };
        (getWorkflowRunById as jest.Mock).mockResolvedValue(runAfterTaskCompletion);
        mockGetWorkflowDefinitionById.mockResolvedValue(sampleFullWorkflowDefinition);

        await processTaskCompletionAndContinueWorkflow(humanTaskId, outputData, userId);

        expect(mockCompleteTaskInService).toHaveBeenCalledWith(humanTaskId, outputData, userId);
        expect(getWorkflowRunById as jest.Mock).toHaveBeenCalledWith(testRunId);
    });
  });
});
