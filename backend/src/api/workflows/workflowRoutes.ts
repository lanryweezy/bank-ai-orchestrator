import * as express from 'express';
import {
    getAllWorkflowDefinitions,
    getWorkflowDefinitionById,
    getWorkflowDefinitionByNameAndVersion
} from '../../services/workflowService';
import {
    createWorkflowRun,
    startWorkflowRunSchema
} from '../../services/workflowRunService';
import { authenticateToken, isBankUser } from '../../middleware/authMiddleware';
import { ZodError } from 'zod';

const router = express.Router();

// Authenticate all routes in this file
router.use(authenticateToken);

// GET /api/workflows - List all active workflow definitions
router.get('/', isBankUser, async (req: express.Request, res: express.Response) => {
  try {
    const workflows = await getAllWorkflowDefinitions({ isActive: true }); // Only active
    res.status(200).json(workflows);
  } catch (error) {
    console.error('Error fetching workflow definitions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/workflows/:workflowId - Get a specific workflow definition by ID
router.get('/:workflowId', isBankUser, async (req: express.Request, res: express.Response) => {
  try {
    const workflow = await getWorkflowDefinitionById(req.params.workflowId);
    if (!workflow || !workflow.is_active) { // Also check if active for non-admins
      return res.status(404).json({ message: 'Active workflow definition not found' });
    }
    res.status(200).json(workflow);
  } catch (error) {
    console.error('Error fetching workflow definition:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/workflows/:workflowId/start - Start a new run of a specific workflow by ID
router.post('/:workflowId/start', isBankUser, async (req: express.Request, res: express.Response) => {
  try {
    const validatedData = startWorkflowRunSchema.parse(req.body);
    const workflowId = req.params.workflowId;
    const userId = req.user!.userId; // Should be present after authenticateToken

    const workflowDefinition = await getWorkflowDefinitionById(workflowId);
    if (!workflowDefinition || !workflowDefinition.is_active) {
        return res.status(404).json({ message: 'Active workflow definition not found.' });
    }

    const workflowRun = await createWorkflowRun(workflowId, userId, validatedData.inputData);
    res.status(201).json(workflowRun);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    console.error('Error starting workflow run:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/workflows/start-by-name - Start a new run of a workflow by name (and optional version)
// This is an alternative to starting by ID, useful if IDs are not exposed or known.
router.post('/start-by-name', isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const validatedData = startWorkflowRunSchema.parse(req.body);
        const workflow_name = req.body.workflow_name;
        const workflow_version = req.body.workflow_version;
        const userId = req.user!.userId;

        if (!workflow_name) {
            return res.status(400).json({ message: 'workflow_name is required in the request body.' });
        }

        const workflowDefinition = await getWorkflowDefinitionByNameAndVersion(workflow_name, workflow_version);
        if (!workflowDefinition) { // Service already checks for is_active
            return res.status(404).json({
                message: `Active workflow definition not found for name "${workflow_name}"` +
                         (workflow_version ? ` and version ${workflow_version}.` : ' (latest version).')
            });
        }

        const workflowRun = await createWorkflowRun(workflowDefinition.workflow_id, userId, validatedData.inputData);
        res.status(201).json(workflowRun);

    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: 'Validation failed', errors: error.errors });
        }
        console.error('Error starting workflow run by name:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;
