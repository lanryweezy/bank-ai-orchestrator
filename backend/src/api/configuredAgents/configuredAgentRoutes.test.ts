import * as request from 'supertest';
import * as express from 'express';
import configuredAgentRoutes from './configuredAgentRoutes';
import * as configuredAgentServiceOriginal from '../../services/configuredAgentService';
import * as authMiddleware from '../../middleware/authMiddleware';

jest.mock('../../services/configuredAgentService', () => ({
  __esModule: true,
  ...jest.requireActual('../../services/configuredAgentService'),
  createConfiguredAgent: jest.fn(),
  getAllConfiguredAgents: jest.fn(),
  getConfiguredAgentById: jest.fn(),
  updateConfiguredAgent: jest.fn(),
  deleteConfiguredAgent: jest.fn(),
  executeAgent: jest.fn(),
}));
const configuredAgentService = jest.requireMock('../../services/configuredAgentService');

jest.mock('../../middleware/authMiddleware');

const app = express();
app.use(express.json());
// Mock middleware for these tests
app.use((req, res, next) => {
  req.user = { userId: 'test-user-id', role: 'bank_user' }; // Mock bank_user
  next();
});
app.use('/configured-agents', configuredAgentRoutes);

describe('Configured Agents API Routes (/configured-agents)', () => {
  const mockCreateConfiguredAgent = configuredAgentService.createConfiguredAgent as jest.Mock;
  const mockGetAllConfiguredAgents = configuredAgentService.getAllConfiguredAgents as jest.Mock;
  const mockGetConfiguredAgentById = configuredAgentService.getConfiguredAgentById as jest.Mock;
  const mockUpdateConfiguredAgent = configuredAgentService.updateConfiguredAgent as jest.Mock;
  const mockDeleteConfiguredAgent = configuredAgentService.deleteConfiguredAgent as jest.Mock;
  const mockExecuteAgent = configuredAgentService.executeAgent as jest.Mock;

  (authMiddleware.authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
    if(!req.user) req.user = { userId: 'test-user-id', role: 'bank_user' };
    next();
  });
  (authMiddleware.isBankUser as jest.Mock).mockImplementation((req, res, next) => next());


  const configuredAgentData = {
    agent_id: 'cfg-agent-1',
    template_id: 'tpl-1',
    user_id: 'test-user-id',
    bank_specific_name: 'My Test Agent',
    configuration_json: { param: 'value' },
    status: 'active'
  };

  beforeEach(() => {
    mockCreateConfiguredAgent.mockReset();
    mockGetAllConfiguredAgents.mockReset();
    mockGetConfiguredAgentById.mockReset();
    mockUpdateConfiguredAgent.mockReset();
    mockDeleteConfiguredAgent.mockReset();
    mockExecuteAgent.mockReset();
  });

  describe('POST /configured-agents', () => {
    it('should create a configured agent', async () => {
      mockCreateConfiguredAgent.mockResolvedValue(configuredAgentData);
      const inputData = {
        template_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Valid UUID
        bank_specific_name: 'My Test Agent',
        configuration_json: { param: 'value' }
      };
      const res = await request(app)
        .post('/configured-agents')
        .send(inputData);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(configuredAgentData);
      expect(mockCreateConfiguredAgent).toHaveBeenCalledWith(inputData, 'test-user-id');
    });
  });

  describe('GET /configured-agents', () => {
    it('should list configured agents for the user', async () => {
      mockGetAllConfiguredAgents.mockResolvedValue([configuredAgentData]);
      const res = await request(app).get('/configured-agents');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([configuredAgentData]);
      expect(mockGetAllConfiguredAgents).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('GET /configured-agents/:agentId', () => {
    it('should get a specific configured agent', async () => {
        mockGetConfiguredAgentById.mockResolvedValue(configuredAgentData);
        const res = await request(app).get('/configured-agents/cfg-agent-1');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(configuredAgentData);
        expect(mockGetConfiguredAgentById).toHaveBeenCalledWith('cfg-agent-1', 'test-user-id');
    });
  });

  describe('PUT /configured-agents/:agentId', () => {
    it('should update a configured agent', async () => {
        const updatePayload = { bank_specific_name: "Updated Agent Name" };
        mockUpdateConfiguredAgent.mockResolvedValue({...configuredAgentData, ...updatePayload});
        const res = await request(app)
            .put('/configured-agents/cfg-agent-1')
            .send(updatePayload);
        expect(res.status).toBe(200);
        expect(res.body.bank_specific_name).toBe("Updated Agent Name");
    });
  });

  describe('DELETE /configured-agents/:agentId', () => {
    it('should delete a configured agent', async () => {
        mockDeleteConfiguredAgent.mockResolvedValue(configuredAgentData);
        const res = await request(app)
            .delete('/configured-agents/cfg-agent-1');
        expect(res.status).toBe(200);
        expect(res.body.agent).toEqual(configuredAgentData);
    });
  });

  describe('POST /configured-agents/:agentId/execute', () => {
    it('should execute an agent', async () => {
        const executionResult = { success: true, output: { data: "done" }};
        mockGetConfiguredAgentById.mockResolvedValue(configuredAgentData); // For the pre-check in route
        mockExecuteAgent.mockResolvedValue(executionResult);
        const inputData = { some_input: "value" };
        const res = await request(app)
            .post('/configured-agents/cfg-agent-1/execute')
            .send({input_data: inputData});
        expect(res.status).toBe(200);
        expect(res.body).toEqual(executionResult);
        expect(mockExecuteAgent).toHaveBeenCalledWith('cfg-agent-1', inputData);
    });
  });

});
