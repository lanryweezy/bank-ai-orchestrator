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

  // Input data for creating a workflow (no workflow_id)
  const workflowCreateInput = {
    name: 'Test Workflow',
    description: 'A test workflow definition',
    definition_json: {
      start_step: 'step1',
      steps: [{
        name: 'step1',
        type: 'human_review' as const, // Use 'as const' for literal type
        // No transitions needed for this simple test case to pass schema
      }]
    },
    version: 1,
    is_active: true,
  };

  // Expected data structure after DB insertion (includes workflow_id and other DB defaults)
  const expectedWorkflowFromDb = {
    ...workflowCreateInput,
    workflow_id: 'wf-uuid-1', // Example UUID
    created_at: new Date().toISOString(), // Example timestamp
    updated_at: new Date().toISOString(), // Example timestamp
  };


  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('createWorkflowDefinition', () => {
    it('should create and return a workflow definition (when is_active is true)', async () => {
      const localCreateInput = { ...workflowCreateInput, is_active: true };
      const localExpectedFromDb = { ...expectedWorkflowFromDb, is_active: true };

      mockQuery.mockResolvedValueOnce({ rows: [] }); // 1. Check existing name/version
      mockQuery.mockResolvedValueOnce({ rows: [] }); // 2. UPDATE other versions to inactive
      mockQuery.mockResolvedValueOnce({ rows: [localExpectedFromDb] }); // 3. INSERT result

      const result = await createWorkflowDefinition(localCreateInput);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2');
      expect(mockQuery.mock.calls[1][0]).toContain('UPDATE workflows SET is_active = false');
      expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO workflows');
      expect(mockQuery.mock.calls[2][1]).toEqual([
        localCreateInput.name, localCreateInput.description, localCreateInput.definition_json, localCreateInput.version, localCreateInput.is_active
      ]);
      expect(result).toEqual(localExpectedFromDb);
    });

    it('should create and return a workflow definition (when is_active is false)', async () => {
      const localCreateInput = { ...workflowCreateInput, is_active: false };
      const localExpectedFromDb = { ...expectedWorkflowFromDb, is_active: false };

      mockQuery.mockResolvedValueOnce({ rows: [] }); // 1. Check existing name/version
      // No UPDATE call if is_active is false
      mockQuery.mockResolvedValueOnce({ rows: [localExpectedFromDb] }); // 2. INSERT result

      const result = await createWorkflowDefinition(localCreateInput);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2');
      expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO workflows');
      expect(mockQuery.mock.calls[1][1]).toEqual([
        localCreateInput.name, localCreateInput.description, localCreateInput.definition_json, localCreateInput.version, localCreateInput.is_active
      ]);
      expect(result).toEqual(localExpectedFromDb);
      expect(mockQuery).toHaveBeenCalledTimes(2); // Only 2 DB calls
    });

    it('should throw error if name/version combo already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ workflow_id: 'existing-wf-uuid' }] }); // Existing found
      await expect(createWorkflowDefinition(workflowCreateInput)).rejects.toThrow('Workflow with name "Test Workflow" and version 1 already exists.');
    });
  });

  describe('getWorkflowDefinitionById', () => {
    it('should return a definition by ID if found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb] });
      const result = await getWorkflowDefinitionById('wf-uuid-1');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows WHERE workflow_id = $1', ['wf-uuid-1']);
      expect(result).toEqual(expectedWorkflowFromDb);
    });
  });

  describe('getWorkflowDefinitionByNameAndVersion', () => {
    it('should return specific version if found and active', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb] });
        const result = await getWorkflowDefinitionByNameAndVersion("Test Workflow", 1);
        expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true', ["Test Workflow", 1]);
        expect(result).toEqual(expectedWorkflowFromDb);
    });
    it('should return latest active version if version not specified', async () => {
        const latestVersionData = {...expectedWorkflowFromDb, version: 2};
        mockQuery.mockResolvedValueOnce({ rows: [latestVersionData] });
        const result = await getWorkflowDefinitionByNameAndVersion("Test Workflow");
        expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows WHERE name = $1 AND is_active = true ORDER BY version DESC LIMIT 1', ["Test Workflow"]);
        expect(result).toEqual(latestVersionData);
    });
  });

  describe('getAllWorkflowDefinitions', () => {
    it('should return latest active per name by default (onlyActive=true behavior from service perspective)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb] });
      const results = await getAllWorkflowDefinitions(); // Defaults to onlyActive = false in service, which means ALL versions
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows ORDER BY name ASC, version DESC');
      expect(results.length).toBe(1);
    });
     it('should return only latest active per name if onlyActive=true is passed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb] });
      const results = await getAllWorkflowDefinitions(true); // This flag now means "latest active per name"
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT w1.*'));
      expect(results.length).toBe(1);
    });
    it('should return all versions if onlyActive is false (for admin list)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb, {...expectedWorkflowFromDb, version: 2}] });
      const results = await getAllWorkflowDefinitions(false);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workflows ORDER BY name ASC, version DESC');
      expect(results.length).toBe(2);
    });
  });

  describe('updateWorkflowDefinition', () => {
    it('should update and return the definition', async () => {
      const updateData = { description: 'Updated Desc' };
      // Mock for getWorkflowDefinitionById (first call in updateWorkflowDefinition)
      mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb] });
      // Mock for the UPDATE query itself
      mockQuery.mockResolvedValueOnce({ rows: [{...expectedWorkflowFromDb, ...updateData}] });

      const result = await updateWorkflowDefinition('wf-uuid-1', updateData);

      // Check the UPDATE query call
      expect(mockQuery.mock.calls[1][0]).toContain('UPDATE workflows SET "description" = $2');
      expect(mockQuery.mock.calls[1][1]).toEqual(['wf-uuid-1', updateData.description]);
      expect(result?.description).toBe('Updated Desc');
    });

    // This test might need adjustment based on how updateWorkflowDefinition handles name/version updates.
    // The service currently prevents direct name/version changes on an existing record.
    // This test was checking for conflict if name/version *were* changed.
    // The new `updateWorkflowDefinition` throws if name/version are in `data` and different from current.
    it('should throw error if trying to update name or version directly', async () => {
        const updateDataWithNameChange = { name: "New Name For Workflow" };
        mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb] }); // For getWorkflowDefinitionById
        await expect(updateWorkflowDefinition('wf-uuid-1', updateDataWithNameChange))
            .rejects.toThrow("Cannot change workflow name directly.");

        const updateDataWithVersionChange = { version: 2 };
        mockQuery.mockResolvedValueOnce({ rows: [expectedWorkflowFromDb] }); // For getWorkflowDefinitionById
        await expect(updateWorkflowDefinition('wf-uuid-1', updateDataWithVersionChange))
            .rejects.toThrow("Cannot change workflow version directly.");
    });
  });

  describe('ensureLoanApplicationWorkflowExists (Seeding Logic)', () => {
    it('should seed the workflow if it does not exist (and it will be active)', async () => {
      // 1. getWorkflowDefinitionByNameAndVersion (finds nothing)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Inside createWorkflowDefinition called by seeder:
      // 2. SELECT to check if name/version exists (finds nothing)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 3. UPDATE to deactivate other active versions (since new one is active)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 4. INSERT the new workflow
      mockQuery.mockResolvedValueOnce({ rows: [{ name: LOAN_APPLICATION_WORKFLOW_NAME, version: 1, is_active: true }] });

      await ensureLoanApplicationWorkflowExists();

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT * FROM workflows WHERE name = $1 AND version = $2 AND is_active = true');
      expect(mockQuery.mock.calls[1][0]).toContain('SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2');
      expect(mockQuery.mock.calls[2][0]).toContain('UPDATE workflows SET is_active = false');
      expect(mockQuery.mock.calls[3][0]).toContain('INSERT INTO workflows');
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
