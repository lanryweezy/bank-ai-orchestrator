import {
  createTask,
  getTaskById,
  getTasksForUser,
  getTasksForAgent,
  getTasksForRun,
  updateTask,
  completeTask,
  TaskCreationData,
  taskInputSchema
} from './taskService';
import * as db from '../config/db';

jest.mock('../config/db');

describe('taskService', () => {
  const mockQuery = db.query as jest.Mock;

  const runId = 'run-uuid-1';
  const userId = 'user-uuid-1';
  const agentId = 'agent-uuid-1';

  const taskData : TaskCreationData & {task_id?: string, status?: string} = {
    run_id: runId,
    step_name_in_workflow: 'human_review_step',
    type: 'human_review',
    assigned_to_user_id: userId,
    input_data_json: { loanAmount: 10000 },
    status: 'assigned' // Default status from createTask logic
  };
   const fullTaskData = { // What DB might return
    task_id: 'task-uuid-1',
    ...taskData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };


  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('createTask', () => {
    it('should create and return a task for human review', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fullTaskData] });
      const result = await createTask(taskData);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks (run_id, step_name_in_workflow, type, assigned_to_agent_id, assigned_to_user_id, assigned_to_role, input_data_json, due_date, status)'),
        [runId, taskData.step_name_in_workflow, taskData.type, undefined, userId, undefined, taskData.input_data_json || {}, undefined, 'assigned']
      );
      expect(result).toEqual(fullTaskData);
    });
    it('should create a task for agent execution', async () => {
        const agentTaskData: TaskCreationData = { ...taskData, type: 'agent_execution', assigned_to_agent_id: agentId, assigned_to_user_id: undefined, assigned_to_role: undefined };
        const fullAgentTaskData = { ...fullTaskData, ...agentTaskData };
        mockQuery.mockResolvedValueOnce({ rows: [fullAgentTaskData] });
        await createTask(agentTaskData);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO tasks (run_id, step_name_in_workflow, type, assigned_to_agent_id, assigned_to_user_id, assigned_to_role, input_data_json, due_date, status)'),
            [runId, agentTaskData.step_name_in_workflow, agentTaskData.type, agentId, undefined, undefined, agentTaskData.input_data_json || {}, undefined, 'assigned']
        );
    });
    it('should throw error if agent task is missing assigned_to_agent_id', async () => {
        const invalidAgentTaskData: TaskCreationData = { ...taskData, type: 'agent_execution', assigned_to_agent_id: undefined, assigned_to_user_id: undefined };
        await expect(createTask(invalidAgentTaskData)).rejects.toThrow('Agent task must have assigned_to_agent_id.');
    });
  });

  describe('getTaskById', () => {
    it('should return a task by ID', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [fullTaskData] });
      const result = await getTaskById('task-uuid-1');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tasks WHERE task_id = $1', ['task-uuid-1']);
      expect(result).toEqual(fullTaskData);
    });
  });

  describe('getTasksForUser', () => {
    it('should return tasks for a user and their role', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [fullTaskData] });
        const result = await getTasksForUser(userId, 'bank_user');
        const expectedQuery = `
    SELECT t.*, wr.workflow_id, w.name as workflow_name
    FROM tasks t
    JOIN workflow_runs wr ON t.run_id = wr.run_id
    JOIN workflows w ON wr.workflow_id = w.workflow_id
    WHERE (t.assigned_to_user_id = $1 OR t.assigned_to_role = $2)
   AND t.type != 'agent_execution' ORDER BY t.created_at DESC
  `;
        expect(mockQuery.mock.calls[0][0].replace(/\s+/g, ' ').trim()).toBe(expectedQuery.replace(/\s+/g, ' ').trim());
        expect(mockQuery.mock.calls[0][1]).toEqual([userId, 'bank_user']);
        expect(result.length).toBe(1);
    });
    it('should return tasks for user with status filter', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [fullTaskData] });
        await getTasksForUser(userId, 'bank_user', 'pending');
        const expectedQuery = `
    SELECT t.*, wr.workflow_id, w.name as workflow_name
    FROM tasks t
    JOIN workflow_runs wr ON t.run_id = wr.run_id
    JOIN workflows w ON wr.workflow_id = w.workflow_id
    WHERE (t.assigned_to_user_id = $1 OR t.assigned_to_role = $2)
   AND t.status = $3 AND t.type != 'agent_execution' ORDER BY t.created_at DESC
  `;
        expect(mockQuery.mock.calls[0][0].replace(/\s+/g, ' ').trim()).toBe(expectedQuery.replace(/\s+/g, ' ').trim());
        expect(mockQuery.mock.calls[0][1]).toEqual([userId, 'bank_user', 'pending']);
    });
  });

  describe('getTasksForRun', () => {
    it('should return tasks for a run ID', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [fullTaskData] });
        const result = await getTasksForRun(runId);
        expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tasks WHERE run_id = $1 ORDER BY created_at ASC', [runId]);
        expect(result.length).toBe(1);
    });
  });


  describe('updateTask', () => {
    it('should update and return the task', async () => {
      const updatePayload = { status: 'in_progress' as const };
      mockQuery.mockResolvedValueOnce({ rows: [{ ...fullTaskData, ...updatePayload }] });
      const result = await updateTask('task-uuid-1', updatePayload);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE tasks SET "status" = $2 WHERE task_id = $1 RETURNING *',
        ['task-uuid-1', 'in_progress']
      );
      expect(result?.status).toBe('in_progress');
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed and set output data', async () => {
      const outputData = { reviewOutcome: 'approved' };
      // Mock for getTaskById
      mockQuery.mockResolvedValueOnce({ rows: [{ ...fullTaskData, status: 'assigned' }] });
      // Mock for updateTask
      mockQuery.mockResolvedValueOnce({ rows: [{ ...fullTaskData, status: 'completed', output_data_json: outputData }] });

      const result = await completeTask('task-uuid-1', outputData, userId);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tasks WHERE task_id = $1', ['task-uuid-1']);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE tasks SET "status" = $2, "output_data_json" = $3 WHERE task_id = $1 RETURNING *',
        ['task-uuid-1', 'completed', outputData]
      );
      expect(result?.status).toBe('completed');
      expect(result?.output_data_json).toEqual(outputData);
    });

    it('should throw error if task not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getTaskById returns null
      await expect(completeTask('task-uuid-1', {}, userId)).rejects.toThrow('Task not found.');
    });
    it('should throw error if task already completed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...fullTaskData, status: 'completed' }] });
      await expect(completeTask('task-uuid-1', {}, userId)).rejects.toThrow('Task is already completed.');
    });
    // Test for user authorization in completeTask is more of an integration/API test with req.user
  });

  describe('taskInputSchema Zod validation', () => {
    it('should validate correct partial data for update', () => {
        const validData = { status: "completed" as const, output_data_json: { result: "done" } };
        expect(() => taskInputSchema.partial().parse(validData)).not.toThrow();
    });
  });

});
