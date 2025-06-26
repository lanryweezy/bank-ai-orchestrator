import * as express from 'express';
import { ZodError } from 'zod';
import {
    workflowDefinitionSchema,
    createWorkflowDefinition,
    updateWorkflowDefinition,
    DANGEROUS_deleteWorkflowDefinition,
} from '../../services/workflowService';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';

const router = express.Router();

// All routes in this file are protected and require platform_admin role
router.use(authenticateToken, isPlatformAdmin);

// POST /api/admin/workflows - Create a new workflow definition
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const data = workflowDefinitionSchema.parse(req.body);
    const workflow = await createWorkflowDefinition(data);
    res.status(201).json(workflow);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('already exists')) { // Custom error from service
        return res.status(409).json({ message: error.message });
    }
    console.error('Error creating workflow definition:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/admin/workflows/:workflowId - Update a workflow definition
router.put('/:workflowId', async (req: express.Request, res: express.Response) => {
  try {
    const data = workflowDefinitionSchema.partial().parse(req.body);
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No update fields provided." });
    }
    const workflow = await updateWorkflowDefinition(req.params.workflowId, data);
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow definition not found' });
    }
    res.status(200).json(workflow);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
     if (error.message.includes('already exists')) { // Custom error from service
        return res.status(409).json({ message: error.message });
    }
    console.error('Error updating workflow definition:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/workflows/:workflowId - Delete a workflow definition (use with caution)
router.delete('/:workflowId', async (req: express.Request, res: express.Response) => {
  try {
    // Note: Service has DANGEROUS_ prefix. Consider soft delete (is_active = false) instead.
    const workflow = await DANGEROUS_deleteWorkflowDefinition(req.params.workflowId);
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow definition not found' });
    }
    res.status(200).json({ message: 'Workflow definition deleted successfully (DANGEROUS)', workflow });
  } catch (error: any) {
    // Add specific error handling for foreign key violations if runs exist
    console.error('Error deleting workflow definition:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
