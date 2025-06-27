import {
  createConfiguredAgent,
  getAllConfiguredAgents,
  getConfiguredAgentById,
  updateConfiguredAgent,
  deleteConfiguredAgent,
  executeAgent, // Will test its orchestration, not the deep logic of specific agents here
  configuredAgentSchema
} from './configuredAgentService';
import * as db from '../config/db';
import * as agentTemplateService from './agentTemplateService'; // For mocking getAgentTemplateById
import * as loanCheckerAgentLogicOriginal from './agentLogic/loanCheckerAgent'; // For mocking specific agent logic

jest.mock('../config/db');
jest.mock('./agentTemplateService');
jest.mock('./agentLogic/loanCheckerAgent', () => ({
  __esModule: true,
  ...jest.requireActual('./agentLogic/loanCheckerAgent'), // Keep original exports like schemas and constants
  executeLoanCheckerAgentLogic: jest.fn(), // Only mock the function we want to control
}));
const loanCheckerAgentLogic = jest.requireMock('./agentLogic/loanCheckerAgent');


describe('configuredAgentService', () => {
  const mockQuery = db.query as jest.Mock;
  const mockGetAgentTemplateById = agentTemplateService.getAgentTemplateById as jest.Mock;
  const mockExecuteLoanCheckerAgentLogic = loanCheckerAgentLogic.executeLoanCheckerAgentLogic as jest.Mock;

  const userId = 'user-uuid-123';
  const templateId = 'template-uuid-456';

  const configuredAgentData = {
    agent_id: 'configured-agent-uuid-789',
    template_id: templateId,
    user_id: userId,
    bank_specific_name: 'My Loan Checker',
    configuration_json: {
        requiredDocumentTypes: ["ID_PROOF"],
        basicWorthinessRules: [] // Explicitly provide default for optional field
    },
    status: 'active',
    template_name: 'Loan Document & Basic Worthiness Checker' // Joined field
  };

  const agentTemplateMock = {
    template_id: templateId,
    name: 'Loan Document & Basic Worthiness Checker',
    core_logic_identifier: loanCheckerAgentLogic.LOAN_CHECKER_AGENT_LOGIC_ID,
    configurable_params_json_schema: loanCheckerAgentLogic.loanCheckerAgentJsonSchema
  };


  beforeEach(() => {
    mockQuery.mockReset();
    mockGetAgentTemplateById.mockReset();
    mockExecuteLoanCheckerAgentLogic.mockReset();
  });

  describe('createConfiguredAgent', () => {
    it('should create and return a configured agent', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [configuredAgentData] });
      // Mock fetching template for potential validation (though not strictly implemented in service yet)
      // mockGetAgentTemplateById.mockResolvedValueOnce(agentTemplateMock);

      const input = {
        template_id: templateId,
        bank_specific_name: 'My Loan Checker',
        configuration_json: { requiredDocumentTypes: ["ID"] },
      };
      const result = await createConfiguredAgent(input, userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO configured_agents (template_id, user_id, bank_specific_name, configuration_json, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [input.template_id, userId, input.bank_specific_name, input.configuration_json, 'active']
      );
      expect(result).toEqual(configuredAgentData);
    });
  });

  describe('getAllConfiguredAgents', () => {
    it('should return all configured agents for a user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [configuredAgentData] });
      const results = await getAllConfiguredAgents(userId);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id WHERE ca.user_id = $1 ORDER BY ca.bank_specific_name ASC',
        [userId]
      );
      expect(results.length).toBe(1);
      expect(results[0]).toEqual(configuredAgentData);
    });
     it('should return all configured agents if no user ID (admin case - simplified)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [configuredAgentData] });
      const results = await getAllConfiguredAgents(); // No userId
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id ORDER BY ca.bank_specific_name ASC'
      );
      expect(results.length).toBe(1);
    });
  });

  describe('getConfiguredAgentById', () => {
    it('should return an agent by ID if found for user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [configuredAgentData] });
      const result = await getConfiguredAgentById(configuredAgentData.agent_id, userId);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT ca.*, at.name as template_name FROM configured_agents ca JOIN agent_templates at ON ca.template_id = at.template_id WHERE agent_id = $1 AND ca.user_id = $2',
        [configuredAgentData.agent_id, userId]
      );
      expect(result).toEqual(configuredAgentData);
    });
  });

  describe('updateConfiguredAgent', () => {
    it('should update and return the agent', async () => {
      const updateData = { bank_specific_name: 'Updated Name' };
      mockQuery.mockResolvedValueOnce({ rows: [{ ...configuredAgentData, ...updateData }] });
      const result = await updateConfiguredAgent(configuredAgentData.agent_id, updateData, userId);
      expect(mockQuery).toHaveBeenCalledWith(
        `UPDATE configured_agents SET "bank_specific_name" = $2 WHERE agent_id = $1 AND user_id = $3 RETURNING *`,
        [configuredAgentData.agent_id, updateData.bank_specific_name, userId]
      );
      expect(result?.bank_specific_name).toBe('Updated Name');
    });
  });

  describe('deleteConfiguredAgent', () => {
    it('should delete and return the agent', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [configuredAgentData] });
      const result = await deleteConfiguredAgent(configuredAgentData.agent_id, userId);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM configured_agents WHERE agent_id = $1 AND user_id = $2 RETURNING *',
        [configuredAgentData.agent_id, userId]
      );
      expect(result).toEqual(configuredAgentData);
    });
  });

  describe('executeAgent', () => {
    it('should call the correct agent logic for LOAN_CHECKER_AGENT_LOGIC_ID', async () => {
      // Mock getConfiguredAgentById to return our test agent
      mockQuery.mockResolvedValueOnce({ rows: [configuredAgentData] });
      // Mock getAgentTemplateById to return the loan checker template
      mockGetAgentTemplateById.mockResolvedValueOnce(agentTemplateMock);
      // Mock the actual loan checker logic
      const mockLogicOutput = { documentsOk: true, missingDocumentTypes: [], rulesCheckResult: { passedAll: true, ruleResults: [] }, overallAssessment: 'Approved' };
      mockExecuteLoanCheckerAgentLogic.mockResolvedValueOnce(mockLogicOutput as any);

      const inputData = { submittedDocuments: [], applicationData: {} };
      const result = await executeAgent(configuredAgentData.agent_id, inputData);

      expect(mockGetAgentTemplateById).toHaveBeenCalledWith(templateId);
      expect(mockExecuteLoanCheckerAgentLogic).toHaveBeenCalledWith(
        configuredAgentData.configuration_json, // Validated config would be passed
        inputData
      );
      expect(result.success).toBe(true);
      expect(result.output).toEqual(mockLogicOutput);
    });

    it('should return failure if agent template has unimplemented logic', async () => {
      const otherTemplate = { ...agentTemplateMock, core_logic_identifier: 'other_logic_v1' };
      mockQuery.mockResolvedValueOnce({ rows: [configuredAgentData] });
      mockGetAgentTemplateById.mockResolvedValueOnce(otherTemplate);

      const result = await executeAgent(configuredAgentData.agent_id, {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('No logic for template type');
    });
     it('should throw error if configured agent not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getConfiguredAgentById returns null
      await expect(executeAgent('non-existent-agent-id', {})).rejects.toThrow('Configured agent not found');
    });
  });

  describe('configuredAgentSchema Zod validation', () => {
    it('should validate correct data', () => {
        const validData = {
            template_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // example UUID
            bank_specific_name: "My Test Agent",
            // configuration_json and status are optional
        };
        expect(() => configuredAgentSchema.parse(validData)).not.toThrow();
    });
    it('should invalidate data with missing required fields', () => {
         const invalidData = { template_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }; // bank_specific_name missing
         expect(() => configuredAgentSchema.parse(invalidData)).toThrow();
    });
     it('should invalidate data with invalid template_id format', () => {
         const invalidData = { template_id: "not-a-uuid", bank_specific_name: "Test" };
         expect(() => configuredAgentSchema.parse(invalidData)).toThrow();
    });
  });

});
