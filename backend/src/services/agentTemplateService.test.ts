import {
  createAgentTemplate,
  getAllAgentTemplates,
  getAgentTemplateById,
  updateAgentTemplate,
  deleteAgentTemplate,
  ensureLoanCheckerAgentTemplateExists, // For testing seeding
  agentTemplateSchema
} from './agentTemplateService';
import * as db from '../config/db';
import { LOAN_CHECKER_AGENT_LOGIC_ID, loanCheckerAgentJsonSchema } from './agentLogic/loanCheckerAgent'; // Corrected import

jest.mock('../config/db'); // Mock the db module

describe('agentTemplateService', () => {
  const mockQuery = db.query as jest.Mock;

  beforeEach(() => {
    mockQuery.mockReset();
  });

  const templateData = {
    name: 'Test Template',
    description: 'A test template',
    core_logic_identifier: 'test_logic_v1',
    configurable_params_json_schema: { type: 'object', properties: { param1: { type: 'string' } } },
  };

  describe('createAgentTemplate', () => {
    it('should create and return an agent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [templateData] });
      const result = await createAgentTemplate(templateData);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO agent_templates (name, description, core_logic_identifier, configurable_params_json_schema) VALUES ($1, $2, $3, $4) RETURNING *',
        [templateData.name, templateData.description, templateData.core_logic_identifier, templateData.configurable_params_json_schema]
      );
      expect(result).toEqual(templateData);
    });
  });

  describe('getAllAgentTemplates', () => {
    it('should return all agent templates', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [templateData, { ...templateData, name: 'Test 2' }] });
      const results = await getAllAgentTemplates();
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM agent_templates ORDER BY name ASC');
      expect(results.length).toBe(2);
    });
  });

  describe('getAgentTemplateById', () => {
    it('should return a template by ID if found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [templateData] });
      const result = await getAgentTemplateById('some-uuid');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM agent_templates WHERE template_id = $1', ['some-uuid']);
      expect(result).toEqual(templateData);
    });
    it('should return null if template not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await getAgentTemplateById('non-existent-uuid');
      expect(result).toBeNull();
    });
  });

  describe('updateAgentTemplate', () => {
    it('should update and return the template', async () => {
      const updateData = { description: 'Updated description' };
      mockQuery.mockResolvedValueOnce({ rows: [{ ...templateData, ...updateData }] });
      const result = await updateAgentTemplate('some-uuid', updateData);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE agent_templates SET "description" = $2 WHERE template_id = $1 RETURNING *',
        ['some-uuid', updateData.description]
      );
      expect(result?.description).toBe('Updated description');
    });
     it('should return current template if no fields to update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [templateData] }); // For the getAgentTemplateById call
      const result = await updateAgentTemplate('some-uuid', {});
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM agent_templates WHERE template_id = $1', ['some-uuid']);
      expect(result).toEqual(templateData);
    });
  });

  describe('deleteAgentTemplate', () => {
    it('should delete and return the template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [templateData] });
      const result = await deleteAgentTemplate('some-uuid');
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM agent_templates WHERE template_id = $1 RETURNING *', ['some-uuid']);
      expect(result).toEqual(templateData);
    });
  });

  describe('ensureLoanCheckerAgentTemplateExists (Seeding Logic)', () => {
    it('should seed the template if it does not exist', async () => {
      // First call to check existence returns no rows
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Second call (createAgentTemplate)
      mockQuery.mockResolvedValueOnce({ rows: [{ name: "Loan Document & Basic Worthiness Checker" }] });

      await ensureLoanCheckerAgentTemplateExists();

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT template_id FROM agent_templates WHERE core_logic_identifier = $1',
        [LOAN_CHECKER_AGENT_LOGIC_ID]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO agent_templates (name, description, core_logic_identifier, configurable_params_json_schema) VALUES ($1, $2, $3, $4) RETURNING *',
        [
          "Loan Document & Basic Worthiness Checker",
          "Checks for required loan documents and evaluates basic worthiness rules against application data.",
          LOAN_CHECKER_AGENT_LOGIC_ID,
          loanCheckerAgentJsonSchema
        ]
      );
    });

    it('should not seed the template if it already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ template_id: 'existing-uuid' }] }); // Template exists

      await ensureLoanCheckerAgentTemplateExists();

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT template_id FROM agent_templates WHERE core_logic_identifier = $1',
        [LOAN_CHECKER_AGENT_LOGIC_ID]
      );
      // Ensure INSERT was not called
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_templates'),
        expect.anything()
      );
    });
  });

  describe('agentTemplateSchema Zod validation', () => {
    it('should validate correct data', () => {
        const validData = {
            name: "Valid Name",
            core_logic_identifier: "valid_logic_id",
            // configurable_params_json_schema is optional
        };
        expect(() => agentTemplateSchema.parse(validData)).not.toThrow();
    });
    it('should invalidate data with missing required fields', () => {
         const invalidData = { name: "Only Name" }; // core_logic_identifier is missing
         expect(() => agentTemplateSchema.parse(invalidData)).toThrow();
    });
  });

});
