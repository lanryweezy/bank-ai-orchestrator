import * as express from 'express';
import { ZodError } from 'zod';
import {
    workflowDefinitionSchema, // Keep one
    workflowDefinitionJsonSchema, // Import for new version payload validation
    createWorkflowDefinition,
    updateWorkflowDefinition,
    DANGEROUS_deleteWorkflowDefinition,
    createNewWorkflowVersionFromLatest,
    getAllWorkflowVersionsByName, // Corrected import name
    getWorkflowDefinitionById,
    getAllWorkflowDefinitions,
    activateWorkflowVersion
} from '../../services/workflowService';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';
import { z } from 'zod'; // Import Zod

const router = express.Router();

// All routes in this file are protected and require platform_admin role
router.use(authenticateToken, isPlatformAdmin);

/**
 * @openapi
 * tags:
 *   name: Admin - Workflow Definitions
 *   description: Manage Workflow Definitions (Admin access required)
 */

/**
 * @openapi
 * /admin/workflows:
 *   post:
 *     tags: [Admin - Workflow Definitions]
 *     summary: Create a new workflow definition
 *     description: Adds a new workflow definition to the system. Requires platform_admin role.
 *                  The combination of name and version must be unique.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkflowDefinitionInput'
 *     responses:
 *       '201':
 *         description: Workflow definition created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowDefinition'
 *       '400':
 *         description: Invalid input data.
 *       '409':
 *         description: Conflict (e.g., name and version combination already exists).
 *       '500':
 *         description: Internal server error.
 */
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    // Ensure version is provided or default it in schema if that's the desired behavior for creation.
    // This route is for creating the FIRST version of a workflow.
    const creationSchema = workflowDefinitionSchema.omit({ version: true });
    // is_active has a default in workflowDefinitionSchema, so client can override or let default.
    // name and definition_json are required by workflowDefinitionSchema.
    const parsedData = creationSchema.parse(req.body);

    const workflow = await createWorkflowDefinition({
      ...parsedData, // Contains name, description (opt), definition_json, is_active (opt)
      version: 1,     // Explicitly set version 1 for this route
    });
    res.status(201).json(workflow);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('already exists')) {
        return res.status(409).json({ message: error.message });
    }
    console.error('Error creating workflow definition (v1):', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /admin/workflows:
 *   get:
 *     tags: [Admin - Workflow Definitions]
 *     summary: List all workflow definitions (admin)
 *     description: Retrieves a list of all workflow definitions, regardless of active status. Requires platform_admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: onlyActive
 *         schema:
 *           type: boolean
 *         description: If true, only returns active workflow definitions. Defaults to false for admin.
 *     responses:
 *       '200':
 *         description: A list of workflow definitions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WorkflowDefinition'
 *       '500':
 *         description: Internal server error.
 */
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const onlyActive = req.query.onlyActive === 'true';
    // For admins, getAllWorkflowDefinitions(false) shows all, true shows only active.
    // The user-facing route /api/workflows already filters by onlyActive=true by default.
    const workflows = await getAllWorkflowDefinitions(onlyActive);
    res.status(200).json(workflows);
  } catch (error) {
    console.error('Error fetching all workflow definitions for admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


/**
 * @openapi
 * /admin/workflows/{workflowId}:
 *   get:
 *     tags: [Admin - Workflow Definitions]
 *     summary: Get a specific workflow definition by ID (admin)
 *     description: Retrieves details of a specific workflow definition by its ID. Requires platform_admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the workflow definition to retrieve.
 *     responses:
 *       '200':
 *         description: Workflow definition details.
 *       '404':
 *         description: Workflow definition not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:workflowId', async (req: express.Request, res: express.Response) => {
  try {
    const workflow = await getWorkflowDefinitionById(req.params.workflowId);
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow definition not found' });
    }
    res.status(200).json(workflow);
  } catch (error) {
    console.error(`Error fetching workflow definition ${req.params.workflowId}:`, error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


/**
 * @openapi
 * /admin/workflows/{workflowId}:
 *   put:
 *     tags: [Admin - Workflow Definitions]
 *     summary: Update an existing workflow definition
 *     description: Modifies an existing workflow definition. Requires platform_admin role.
 *                  Note: Updating name or version might be restricted if it causes conflicts.
 *                  Consider creating a new version for significant changes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the workflow definition to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkflowDefinitionInput' # Can be partial for updates
 *     responses:
 *       '200':
 *         description: Workflow definition updated successfully.
 *       '400':
 *         description: Invalid input data or no fields to update.
 *       '404':
 *         description: Workflow definition not found.
 *       '409':
 *         description: Conflict (e.g., name and version combination already exists for another record).
 *       '500':
 *         description: Internal server error.
 */
router.put('/:workflowId', async (req: express.Request, res: express.Response) => {
  try {
    // Using .partial() to allow updating specific fields without requiring all.
    // This route updates a specific version's details (description, definition_json, is_active).
    // Name and version number are immutable for an existing record.
    const data = workflowDefinitionSchema.pick({
        description: true,
        definition_json: true,
        is_active: true
    }).partial().parse(req.body);

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No update fields provided." });
    }

    const workflow = await updateWorkflowDefinition(req.params.workflowId, data);
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow definition (version) not found or update failed' });
    }
    res.status(200).json(workflow);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('Workflow (version) not found for update')) { // Error from service
        return res.status(404).json({ message: error.message });
    }
    console.error('Error updating workflow definition (version):', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /admin/workflows/{workflowId}:
 *   delete:
 *     tags: [Admin - Workflow Definitions]
 *     summary: Delete a workflow definition (admin)
 *     description: Removes a workflow definition from the system. Requires platform_admin role.
 *                  Caution: This is a hard delete. Consider deactivating (is_active=false) instead
 *                  if there are existing workflow runs associated with this definition.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the workflow definition to delete.
 *     responses:
 *       '200':
 *         description: Workflow definition deleted successfully.
 *       '404':
 *         description: Workflow definition not found.
 *       '409':
 *         description: Conflict - workflow definition in use (if such check is implemented).
 *       '500':
 *         description: Internal server error.
 */
router.delete('/:workflowId', async (req: express.Request, res: express.Response) => {
  try {
    // The service function is DANGEROUS_deleteWorkflowDefinition.
    // A check for existing workflow_runs using this workflow_id should be added
    // in the service or here to prevent orphaned runs or provide a clearer error.
    // For example:
    // const runs = await query('SELECT 1 FROM workflow_runs WHERE workflow_id = $1 LIMIT 1', [req.params.workflowId]);
    // if (runs.rows.length > 0) {
    //   return res.status(409).json({ message: 'Conflict: This workflow definition is used by existing workflow runs. Consider deactivating it instead.' });
    // }
    const workflow = await DANGEROUS_deleteWorkflowDefinition(req.params.workflowId);
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow definition (version) not found' });
    }
    res.status(200).json({ message: 'Workflow definition (version) deleted successfully. (DANGEROUS)', workflow });
  } catch (error: any) {
    // Handle foreign key constraint violation (e.g., '23503') if workflow_runs exist
     if (error.code === '23503' && error.constraint === 'workflow_runs_workflow_id_fkey') {
        return res.status(409).json({
            message: 'Conflict: This workflow definition version is currently in use by one or more workflow runs. Please ensure all runs are completed or removed, or deactivate the workflow instead.'
        });
    }
    console.error('Error deleting workflow definition (version):', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// == NEW ROUTES FOR VERSIONING ==

/**
 * @openapi
 * /admin/workflows/name/{name}/versions:
 *   post:
 *     tags: [Admin - Workflow Definitions]
 *     summary: Create a new version for an existing workflow name
 *     description: Creates a new, incremented version for a workflow specified by its name.
 *                  The new version will be marked active, and previous active versions for this name will be deactivated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the workflow to create a new version for.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 nullable: true
 *               definition_json:
 *                 type: object
 *                 nullable: true
 *               is_active: # Not usually needed here as new versions are typically active by default
 *                 type: boolean
 *                 nullable: true
 *                 default: true
 *             example:
 *               description: "Updated processing rules for loan applications"
 *               definition_json: { "new_schema": "details..." }
 *     responses:
 *       '201':
 *         description: New workflow version created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowDefinition'
 *       '400':
 *         description: Invalid input.
 *       '404':
 *         description: Base workflow name not found (if strict about needing prior versions).
 *       '500':
 *         description: Internal server error.
 */
router.post('/name/:name/versions', async (req: express.Request, res: express.Response) => {
    try {
        const workflowName = req.params.name;
        // For creating a new version, definition_json is required.
        // Description and is_active are optional (service/schema defaults apply for is_active).
        const newVersionDataSchema = z.object({
            description: z.string().optional().nullable(),
            definition_json: workflowDefinitionJsonSchema, // Copied from workflowService for direct use
            is_active: z.boolean().optional(), // Service defaults to true if not provided
        });
        const parsedData = newVersionDataSchema.parse(req.body);

        const newVersion = await createNewWorkflowVersionFromLatest(workflowName, {
            description: parsedData.description ?? undefined, // Ensure undefined not null if that's what service expects
            definition_json: parsedData.definition_json,
            is_active: parsedData.is_active,
        });
        res.status(201).json(newVersion);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: 'Validation failed for new version data', errors: error.errors });
        }
        if (error.message.includes('not found to create a new version from')) {
            return res.status(404).json({ message: error.message });
        }
        console.error(`Error creating new version for workflow ${req.params.name}:`, error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


/**
 * @openapi
 * /admin/workflows/name/{name}/versions:
 *   get:
 *     tags: [Admin - Workflow Definitions]
 *     summary: List all versions of a workflow by name
 *     description: Retrieves all versions of a specific workflow, ordered by version number (descending).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the workflow.
 *     responses:
 *       '200':
 *         description: A list of workflow versions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WorkflowDefinition'
 *       '404':
 *         description: Workflow with that name not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/name/:name/versions', async (req: express.Request, res: express.Response) => {
    try {
        const workflowName = req.params.name;
        const versions = await getAllWorkflowVersionsByName(workflowName); // Corrected function name
        if (versions.length === 0) {
            // Distinguish between "no workflow with this name" vs "workflow exists but has no versions" (should not happen with current logic)
            // For simplicity, if service returns empty, assume name not found or no versions.
            // A better check might be to see if the name exists at all.
        }
        res.status(200).json(versions);
    } catch (error) {
        console.error(`Error fetching versions for workflow ${req.params.name}:`, error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/workflows/{workflowId}/activate:
 *   put:
 *     tags: [Admin - Workflow Definitions]
 *     summary: Activate a specific workflow version
 *     description: Marks a specific workflow version (by ID) as active. If other versions of the same workflow name are active, they will be deactivated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the workflow version to activate.
 *     responses:
 *       '200':
 *         description: Workflow version activated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowDefinition'
 *       '404':
 *         description: Workflow version not found.
 *       '500':
 *         description: Internal server error.
 */
router.put('/:workflowId/activate', async (req: express.Request, res: express.Response) => {
    try {
        const activatedWorkflow = await activateWorkflowVersion(req.params.workflowId);
        if (!activatedWorkflow) { // Should be handled by service throwing error if not found
            return res.status(404).json({ message: 'Workflow version not found or activation failed.' });
        }
        res.status(200).json(activatedWorkflow);
    } catch (error: any) {
        if (error.message.includes('Workflow version not found')) {
            return res.status(404).json({ message: error.message });
        }
        console.error(`Error activating workflow version ${req.params.workflowId}:`, error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;
