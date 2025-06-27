import * as request from 'supertest';
import * as express from 'express';
import taskRoutes from './taskRoutes';
import * as taskServiceOriginal from '../../services/taskService';
import * as workflowRunServiceOriginal from '../../services/workflowRunService'; // For processTaskCompletion
import * as authMiddleware from '../../middleware/authMiddleware';

jest.mock('../../services/taskService', () => ({
  __esModule: true,
  ...jest.requireActual('../../services/taskService'),
  getTaskById: jest.fn(),
  getTasksForUser: jest.fn(),
  // completeTask is not directly called by route, processTaskCompletionAndContinueWorkflow is
}));
const taskService = jest.requireMock('../../services/taskService');

jest.mock('../../services/workflowRunService', () => ({
  __esModule: true,
  ...jest.requireActual('../../services/workflowRunService'),
  processTaskCompletionAndContinueWorkflow: jest.fn(),
}));
const workflowRunService = jest.requireMock('../../services/workflowRunService');


jest.mock('../../middleware/authMiddleware');

const app = express();
app.use(express.json());
// Mock middleware
app.use((req: any, res: any, next: any) => {
  req.user = { userId: 'test-user-id', role: 'bank_user' };
  next();
});
app.use('/tasks', taskRoutes);

describe('Task API Routes (/tasks)', () => {
  const mockGetTasksForUser = taskService.getTasksForUser as jest.Mock;
  const mockGetTaskById = taskService.getTaskById as jest.Mock;
  const mockProcessTaskCompletionAndContinueWorkflow = workflowRunService.processTaskCompletionAndContinueWorkflow as jest.Mock;

  (authMiddleware.authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
    if(!req.user) req.user = { userId: 'test-user-id', role: 'bank_user' };
    next();
  });
  (authMiddleware.isBankUser as jest.Mock).mockImplementation((req, res, next) => next());

  const taskData = {
    task_id: 'task-1',
    run_id: 'run-1',
    step_name_in_workflow: 'human_review',
    type: 'human_review',
    assigned_to_user_id: 'test-user-id',
    status: 'assigned'
  };

  beforeEach(() => {
    mockGetTasksForUser.mockReset();
    mockGetTaskById.mockReset();
    mockProcessTaskCompletionAndContinueWorkflow.mockReset();
  });

  describe('GET /tasks', () => {
    it('should list tasks for the authenticated user', async () => {
      mockGetTasksForUser.mockResolvedValue([taskData]);
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([taskData]);
      expect(mockGetTasksForUser).toHaveBeenCalledWith('test-user-id', 'bank_user', undefined);
    });
    it('should list tasks for user with status filter', async () => {
      mockGetTasksForUser.mockResolvedValue([taskData]);
      const res = await request(app).get('/tasks?status=assigned');
      expect(res.status).toBe(200);
      expect(mockGetTasksForUser).toHaveBeenCalledWith('test-user-id', 'bank_user', 'assigned');
    });
  });

  describe('GET /tasks/:taskId', () => {
    it('should get a specific task if user is authorized', async () => {
      mockGetTaskById.mockResolvedValue(taskData);
      const res = await request(app).get('/tasks/task-1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(taskData);
    });
    it('should return 404 if task not found', async () => {
      mockGetTaskById.mockResolvedValue(null);
      const res = await request(app).get('/tasks/task-nonexist');
      expect(res.status).toBe(404);
    });
    // Add test for authorization if user is not assigned and not admin (currently commented out in route)
  });

  describe('POST /tasks/:taskId/complete', () => {
    it('should complete a task and trigger workflow progression', async () => {
      const outputData = { reviewOutcome: 'approved' };
      const updatedTask = { ...taskData, status: 'completed', output_data_json: outputData };
      mockProcessTaskCompletionAndContinueWorkflow.mockResolvedValue(updatedTask);

      const res = await request(app)
        .post('/tasks/task-1/complete')
        .send({ output_data_json: outputData });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updatedTask);
      expect(mockProcessTaskCompletionAndContinueWorkflow).toHaveBeenCalledWith('task-1', outputData, 'test-user-id');
    });
    it('should return 400 if task completion fails (e.g., already completed)', async () => {
        mockProcessTaskCompletionAndContinueWorkflow.mockRejectedValue(new Error("Task is already completed"));
        const res = await request(app)
            .post('/tasks/task-1/complete')
            .send({ output_data_json: {} });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Task is already completed");
    });
  });

});
