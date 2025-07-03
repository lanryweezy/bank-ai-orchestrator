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
        // The route expects a full valid payload for agentTemplateSchema.parse()
        const fullUpdatePayload = {
            name: templateData.name, // Keep name or provide a valid new one
            core_logic_identifier: templateData.core_logic_identifier, // Keep or provide valid
            description: "New Description", // The actual change
            configurable_params_json_schema: templateData.configurable_params_json_schema
        };
        mockUpdateAgentTemplate.mockResolvedValue({...templateData, ...fullUpdatePayload});
        const res = await request(app)
            .put('/admin/agent-templates/tpl-1')
            .send(fullUpdatePayload);
        expect(res.status).toBe(200);
        expect(res.body.description).toBe("New Description");
        // The service function updateAgentTemplate receives the full payload due to schema parsing in route
        expect(mockUpdateAgentTemplate).toHaveBeenCalledWith('tpl-1', fullUpdatePayload);
    });
     it('should return 404 if template not found for update', async () => {
        mockUpdateAgentTemplate.mockResolvedValue(null);
        // Payload must still be valid for agentTemplateSchema.parse() to pass before service call
        const validPayloadForNotFound = {
            name: "Any Valid Name",
            core_logic_identifier: "any_valid_core_id",
            description: "New Desc"
        };
        const res = await request(app)
            .put('/admin/agent-templates/tpl-nonexist')
            .send(validPayloadForNotFound);
        expect(res.status).toBe(404);
    });
  });

  describe('DELETE /admin/agent-templates/:templateId', () => {
    it('should delete an agent template', async () => {
        mockDeleteAgentTemplate.mockResolvedValue(templateData);
        const res = await request(app)
            .delete('/admin/agent-templates/tpl-1');
        expect(res.status).toBe(200); // Route returns 200 with body
        expect(res.body.message).toBe('Agent template deleted successfully');
        expect(res.body.template).toEqual(templateData);
        expect(mockDeleteAgentTemplate).toHaveBeenCalledWith('tpl-1');
    });
    it('should return 409 if template in use', async () => {
        const dbError = new Error('DB error simulating FK violation');
        (dbError as any).code = '23503';
        (dbError as any).constraint = 'configured_agents_template_id_fkey';
        mockDeleteAgentTemplate.mockRejectedValue(dbError);

        const res = await request(app)
            .delete('/admin/agent-templates/tpl-1');
        expect(res.status).toBe(409);
        expect(res.body.message).toContain('Conflict: This agent template is currently in use');
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
