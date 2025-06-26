import {
  createWorkflowDefinition,
  getWorkflowDefinitionById,
  getWorkflowDefinitionByNameAndVersion,
  getAllWorkflowDefinitions,
  updateWorkflowDefinition,
  DANGEROUS_deleteWorkflowDefinition,
  ensureLoanApplicationWorkflowExists, // For testing seeding
  LOAN_APPLICATION_WORKFLOW_NAME,     // For testing seeding
  workflowDefinitionSchema
} from './workflowService';
import * as db from '../config/db';
import { LOAN_CHECKER_AGENT_LOGIC_ID } from './agentLogic/loanCheckerAgent';


jest.mock('../config/db');

describe('workflowService', () => {
  const mockQuery = db.query as jest.Mock;

  const workflowDefData = {
    workflow_id: 'wf-uuid-1',
    name: 'Test Workflow',
    description: 'A test workflow definition',
    definition_json: { steps: [{ name: 'step1', type: 'human_review' }], start_step: 'step1' },
    version: 1,
    is_active: true,
  };

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('createWorkflowDefinition', () => {
    it('should create and return a workflow definition', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existing name/version combo
      mockQuery.mockResolvedValueOnce({ rows: [workflowDefData] }); // Insert result
      const result = await createWorkflowDefinition(workflowDefData);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO workflows (name, description, definition_json, version, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [workflowDefData.name, workflowDefData.description, workflowDefData.definition_json, workflowDefData.version, workflowDefData.is_active]
      );
      expect(result).toEqual(workflowDefData);
    });
    it('should throw error if name/version combo already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ workflow_id: 'existing-wf-uuid' }] }); // Existing found
      await expect(createWorkflowDefinition(workflowDefData)).rejects.toThrow('Workflow with name "Test Workflow" and version 1 already exists.');
    });
  });

  describe('getWorkflowDefinitionById', () => {
    it('should return a definition by ID if found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [workflowDefData] });
      const result = await getWorkflowDefinitionById('wf-uuid-1');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows WHERE workflow_id = $1', ['wf-uuid-1']);
      expect(result).toEqual(workflowDefData);
    });
  });

  describe('getWorkflowDefinitionByNameAndVersion', () => {
    it('should return specific version if found and active', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [workflowDefData] });
        const result = await getWorkflowDefinitionByNameAndVersion("Test Workflow", 1);
        expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true', ["Test Workflow", 1]);
        expect(result).toEqual(workflowDefData);
    });
    it('should return latest active version if version not specified', async () => {
        const latestVersionData = {...workflowDefData, version: 2};
        mockQuery.mockResolvedValueOnce({ rows: [latestVersionData] });
        const result = await getWorkflowDefinitionByNameAndVersion("Test Workflow");
        expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows WHERE name = $1 AND is_active = true ORDER BY version DESC LIMIT 1', ["Test Workflow"]);
        expect(result).toEqual(latestVersionData);
    });
  });

  describe('getAllWorkflowDefinitions', () => {
    it('should return all definitions', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [workflowDefData] });
      const results = await getAllWorkflowDefinitions();
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows ORDER BY name ASC, version DESC');
      expect(results.length).toBe(1);
    });
     it('should return only active definitions if specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [workflowDefData] });
      const results = await getAllWorkflowDefinitions(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows WHERE is_active = true ORDER BY name ASC, version DESC');
      expect(results.length).toBe(1);
    });
  });

  describe('updateWorkflowDefinition', () => {
    it('should update and return the definition', async () => {
      const updateData = { description: 'Updated Desc' };
      mockQuery.mockResolvedValueOnce({ rows: [{...workflowDefData, ...updateData}] }); // For the update
      const result = await updateWorkflowDefinition('wf-uuid-1', updateData);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE workflows SET "description" = $2 WHERE workflow_id = $1 RETURNING *',
        ['wf-uuid-1', updateData.description]
      );
      expect(result?.description).toBe('Updated Desc');
    });
    it('should throw if trying to update name/version to an existing combination', async () => {
        const updateData = { name: "ExistingOtherWorkflow", version: 1 };
        // Mock for getWorkflowDefinitionById (called inside update for current values)
        mockQuery.mockResolvedValueOnce({ rows: [workflowDefData] });
        // Mock for checking existing name/version combo
        mockQuery.mockResolvedValueOnce({ rows: [{ workflow_id: 'other-wf-uuid' }] });

        await expect(updateWorkflowDefinition('wf-uuid-1', updateData))
            .rejects.toThrow('Another workflow with name "ExistingOtherWorkflow" and version 1 already exists.');
    });
  });

  describe('ensureLoanApplicationWorkflowExists (Seeding Logic)', () => {
    it('should seed the workflow if it does not exist', async () => {
      // Mock for getWorkflowDefinitionByNameAndVersion's SELECT (returns empty, so it doesn't exist)
      mockQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
      // Mock for createWorkflowDefinition's SELECT (check before insert - also returns empty)
      mockQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
      // Mock for createWorkflowDefinition's INSERT
      mockQuery.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: LOAN_APPLICATION_WORKFLOW_NAME, version: 1 }] }));

      await ensureLoanApplicationWorkflowExists();

      // getWorkflowDefinitionByNameAndVersion was called (its query was mocked as the first one)
      // createWorkflowDefinition was called (its two queries were mocked as second and third)
      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true'); // From getByNameAndVersion
      expect(mockQuery.mock.calls[1][0]).toContain('SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2'); // From create (check)
      expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO workflows'); // From create (insert)
    });

    it('should not seed if workflow already exists', async () => {
        // Mock for getWorkflowDefinitionByNameAndVersion's SELECT (returns existing)
        mockQuery.mockResolvedValueOnce({ rows: [{ workflow_id: 'existing-wf-uuid', name: LOAN_APPLICATION_WORKFLOW_NAME, version: 1}] });

        await ensureLoanApplicationWorkflowExists();

        expect(mockQuery).toHaveBeenCalledTimes(1); // Only the initial check query
        expect(mockQuery.mock.calls[0][0]).toContain('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true');
    });
  });

  describe('workflowDefinitionSchema Zod validation', () => {
    it('should validate correct data', () => {
        const validData = {
            name: "Valid Workflow",
            definition_json: { start_step: "s1", steps: [] },
            // version and is_active are optional with defaults
        };
        expect(() => workflowDefinitionSchema.parse(validData)).not.toThrow();
    });
    it('should invalidate data with missing required fields', () => {
         const invalidData = { name: "Only Name" }; // definition_json is missing
         expect(() => workflowDefinitionSchema.parse(invalidData)).toThrow();
    });
  });

});
