import * as request from 'supertest';
import * as express from 'express';
import agentTemplateAdminRoutes from './agentTemplateAdminRoutes';
import * as agentTemplateServiceOriginal from '../../services/agentTemplateService'; // Actual service
import * as authMiddleware from '../../middleware/authMiddleware'; // To mock middleware

// Mock service but retain schemas
jest.mock('../../services/agentTemplateService', () => ({
  __esModule: true,
  ...jest.requireActual('../../services/agentTemplateService'), // Retain original exports like schemas
  createAgentTemplate: jest.fn(),
  updateAgentTemplate: jest.fn(),
  deleteAgentTemplate: jest.fn(),
  getAgentTemplateById: jest.fn(),
  getAllAgentTemplates: jest.fn(), // if used by any tested route indirectly
}));
const agentTemplateService = jest.requireMock('../../services/agentTemplateService'); // Get the mocked service for jest.Mock typing

jest.mock('../../middleware/authMiddleware');

const app = express();
app.use(express.json());
// Apply a mock authenticateToken and isPlatformAdmin for these tests
app.use((req, res, next) => {
  req.user = { userId: 'admin-user-id', role: 'platform_admin' }; // Mock user
  next();
});
app.use('/admin/agent-templates', agentTemplateAdminRoutes);


describe('Agent Template Admin API Routes (/admin/agent-templates)', () => {
  const mockCreateAgentTemplate = agentTemplateService.createAgentTemplate as jest.Mock;
  const mockUpdateAgentTemplate = agentTemplateService.updateAgentTemplate as jest.Mock;
  const mockDeleteAgentTemplate = agentTemplateService.deleteAgentTemplate as jest.Mock;
  const mockGetAgentTemplateById = agentTemplateService.getAgentTemplateById as jest.Mock;

  // Mock the actual middleware functions to effectively disable them for these direct route tests
  // or to assert they were called if not globally applied as above.
  (authMiddleware.authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
    // If not globally mocked, set req.user here
    if(!req.user) req.user = { userId: 'admin-user-id', role: 'platform_admin' };
    next();
  });
  (authMiddleware.isPlatformAdmin as jest.Mock).mockImplementation((req, res, next) => next());


  const templateData = {
    template_id: 'tpl-1',
    name: 'Test Template Admin',
    description: 'For admin API',
    core_logic_identifier: 'admin_test_v1',
    configurable_params_json_schema: { type: 'object' }
  };

  beforeEach(() => {
    mockCreateAgentTemplate.mockReset();
    mockUpdateAgentTemplate.mockReset();
    mockDeleteAgentTemplate.mockReset();
    mockGetAgentTemplateById.mockReset();
  });

  describe('POST /admin/agent-templates', () => {
    it('should create an agent template for platform_admin', async () => {
      mockCreateAgentTemplate.mockResolvedValue(templateData);
      const res = await request(app)
        .post('/admin/agent-templates')
        .send(templateData);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(templateData);
      expect(mockCreateAgentTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: templateData.name }));
    });
    it('should return 400 for invalid data', async () => {
        const res = await request(app)
            .post('/admin/agent-templates')
            .send({ name: 'T' }); // Invalid: name too short
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('PUT /admin/agent-templates/:templateId', () => {
    it('should update an agent template', async () => {
        const updatePayload = { description: "New Description" };
        mockUpdateAgentTemplate.mockResolvedValue({...templateData, ...updatePayload});
        const res = await request(app)
            .put('/admin/agent-templates/tpl-1')
            .send(updatePayload);
        expect(res.status).toBe(200);
        expect(res.body.description).toBe("New Description");
        expect(mockUpdateAgentTemplate).toHaveBeenCalledWith('tpl-1', updatePayload);
    });
     it('should return 404 if template not found for update', async () => {
        mockUpdateAgentTemplate.mockResolvedValue(null);
        const res = await request(app)
            .put('/admin/agent-templates/tpl-nonexist')
            .send({ description: "New Desc" });
        expect(res.status).toBe(404);
    });
  });

  describe('DELETE /admin/agent-templates/:templateId', () => {
    it('should delete an agent template', async () => {
        mockDeleteAgentTemplate.mockResolvedValue(templateData);
        const res = await request(app)
            .delete('/admin/agent-templates/tpl-1');
        expect(res.status).toBe(200);
        expect(res.body.template).toEqual(templateData);
        expect(mockDeleteAgentTemplate).toHaveBeenCalledWith('tpl-1');
    });
    it('should return 409 if template in use', async () => {
        mockDeleteAgentTemplate.mockRejectedValue(new Error('violates foreign key constraint "configured_agents_template_id_fkey"'));
        const res = await request(app)
            .delete('/admin/agent-templates/tpl-1');
        expect(res.status).toBe(409);
        expect(res.body.message).toContain('Cannot delete template: It is currently in use');
    });
  });

  describe('GET /admin/agent-templates/:templateId', () => {
    it('should get a specific template', async () => {
        mockGetAgentTemplateById.mockResolvedValue(templateData);
        const res = await request(app)
            .get('/admin/agent-templates/tpl-1');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(templateData);
    });
  });

});
