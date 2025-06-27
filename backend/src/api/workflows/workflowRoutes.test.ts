import * as request from 'supertest';
import * as express from 'express';
import workflowRoutes from './workflowRoutes'; // For user-facing parts
import workflowAdminRoutes from '../admin/workflowAdminRoutes'; // For admin parts
import * as workflowServiceOriginal from '../../services/workflowService';
import * as workflowRunServiceOriginal from '../../services/workflowRunService';
import * as authMiddleware from '../../middleware/authMiddleware';

jest.mock('../../services/workflowService', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/workflowService'),
    createWorkflowDefinition: jest.fn(),
    getAllWorkflowDefinitions: jest.fn(),
    getWorkflowDefinitionById: jest.fn(),
    getWorkflowDefinitionByNameAndVersion: jest.fn(),
}));
const workflowService = jest.requireMock('../../services/workflowService');

jest.mock('../../services/workflowRunService', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/workflowRunService'),
    createWorkflowRun: jest.fn(),
}));
const workflowRunService = jest.requireMock('../../services/workflowRunService');

jest.mock('../../middleware/authMiddleware', () => ({
  __esModule: true,
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    // Allow tests to set role via header for more granular control if needed,
    // otherwise default to a role. For adminApp, it's overridden anyway.
    req.user = { userId: 'test-user-id', role: req.headers['x-test-role'] || 'bank_user' };
    next();
  }),
  isBankUser: jest.fn((req: any, res: any, next: any) => next()), // Default pass for bank_user routes
  isPlatformAdmin: jest.fn((req: any, res: any, next: any) => { // Stricter check for admin routes
    if (req.user && req.user.role === 'platform_admin') {
      next();
    } else {
      // Send 403 if role is not platform_admin. This helps verify middleware is hit.
      res.status(403).json({ message: 'Test Middleware: Access denied. Requires platform_admin role.' });
    }
  }),
}));
// We don't need to type cast authMiddleware.isPlatformAdmin etc. as jest.Mock here
// because we are providing the full factory.

const app = express(); // General app, not used directly for requests in this new setup

// Setup for admin routes
const adminApp = express();
adminApp.use(express.json());
// The authenticateToken mock will run, and we can ensure 'platform_admin' role is set for these requests.
// isPlatformAdmin mock will then specifically check for this role.
adminApp.use('/admin/workflows', workflowAdminRoutes);


// Setup for user routes
const userApp = express();
userApp.use(express.json());
// The authenticateToken mock will run, defaulting to 'bank_user' if no X-Test-Role header.
// isBankUser mock just calls next().
userApp.use('/workflows', workflowRoutes);


describe('Workflow Definition APIs', () => {
  const mockCreateWorkflowDefinition = workflowService.createWorkflowDefinition as jest.Mock;
  const mockGetAllWorkflowDefinitions = workflowService.getAllWorkflowDefinitions as jest.Mock;
  const mockGetWorkflowDefinitionById = workflowService.getWorkflowDefinitionById as jest.Mock;
  const mockCreateWorkflowRun = workflowRunService.createWorkflowRun as jest.Mock;
  const mockGetWorkflowDefinitionByNameAndVersion = workflowService.getWorkflowDefinitionByNameAndVersion as jest.Mock;

  const workflowDefData = {
    workflow_id: 'wf-1',
    name: 'Test Workflow',
    definition_json: { start_step: 's1', steps: [] },
    version: 1,
    is_active: true
  };

  beforeEach(() => {
    mockCreateWorkflowDefinition.mockReset();
    mockGetAllWorkflowDefinitions.mockReset();
    mockGetWorkflowDefinitionById.mockReset();
    mockCreateWorkflowRun.mockReset();
    mockGetWorkflowDefinitionByNameAndVersion.mockReset();
  });

  // Admin Routes
  describe('POST /admin/workflows (Admin)', () => {
    it('should create a workflow definition', async () => {
      mockCreateWorkflowDefinition.mockResolvedValue(workflowDefData);
      const res = await request(adminApp)
        .post('/admin/workflows')
        .set('X-Test-Role', 'platform_admin') // Set role for this request
        .send(workflowDefData);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(workflowDefData);
    });
  });

  // User Routes
  describe('GET /workflows (User)', () => {
    it('should list active workflow definitions', async () => {
      mockGetAllWorkflowDefinitions.mockResolvedValue([workflowDefData]);
      const res = await request(userApp).get('/workflows');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([workflowDefData]);
      expect(mockGetAllWorkflowDefinitions).toHaveBeenCalledWith(true); // onlyActive = true
    });
  });

  describe('GET /workflows/:workflowId (User)', () => {
    it('should get an active workflow definition by ID', async () => {
      mockGetWorkflowDefinitionById.mockResolvedValue(workflowDefData);
      const res = await request(userApp).get('/workflows/wf-1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(workflowDefData);
    });
    it('should return 404 if workflow is inactive or not found', async () => {
      mockGetWorkflowDefinitionById.mockResolvedValue({...workflowDefData, is_active: false });
      const res = await request(userApp).get('/workflows/wf-1');
      expect(res.status).toBe(404); // Because is_active is false
    });
  });

  describe('POST /workflows/:workflowId/start (User)', () => {
    it('should start a workflow instance', async () => {
      const runData = { run_id: 'run-1', workflow_id: 'wf-1', status: 'pending' };
      mockGetWorkflowDefinitionById.mockResolvedValue(workflowDefData); // Workflow must exist and be active
      mockCreateWorkflowRun.mockResolvedValue(runData);
      const triggeringData = { appId: '123' };
      const res = await request(userApp)
        .post('/workflows/wf-1/start')
        .send({ triggering_data_json: triggeringData });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(runData);
      expect(mockCreateWorkflowRun).toHaveBeenCalledWith('wf-1', 'test-user-id', triggeringData);
    });
  });

  describe('POST /workflows/start-by-name (User)', () => {
    it('should start a workflow by name and version', async () => {
        const runData = { run_id: 'run-1', workflow_id: 'wf-1', status: 'pending' };
        mockGetWorkflowDefinitionByNameAndVersion.mockResolvedValue(workflowDefData);
        mockCreateWorkflowRun.mockResolvedValue(runData);
        const payload = { workflow_name: "Test Workflow", workflow_version: 1, triggering_data_json: {key: "val"} };

        const res = await request(userApp)
            .post('/workflows/start-by-name')
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body).toEqual(runData);
        expect(mockGetWorkflowDefinitionByNameAndVersion).toHaveBeenCalledWith("Test Workflow", 1);
        expect(mockCreateWorkflowRun).toHaveBeenCalledWith(workflowDefData.workflow_id, 'test-user-id', payload.triggering_data_json);
    });
  });

});
