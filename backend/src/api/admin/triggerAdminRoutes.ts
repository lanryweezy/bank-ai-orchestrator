// backend/src/api/admin/triggerAdminRoutes.ts
import express from 'express';
import { ZodError } from 'zod';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';
import {
    triggerInputSchema,
    triggerUpdateSchema,
    createTrigger,
    getTriggerById,
    updateTrigger,
    deleteTrigger,
    getTriggersByWorkflowId,
} from '../../services/triggerService';
import { z } from 'zod'; // Already imported by previous step, but good to ensure

const router = express.Router();

router.use(authenticateToken, isPlatformAdmin);

/**
 * @openapi
 * tags:
 *   name: Admin - Workflow Triggers
 *   description: Manage Workflow Triggers (Admin access required)
 */

/**
 * @openapi
 * /admin/triggers:
 *   post:
 *     tags: [Admin - Workflow Triggers]
 *     summary: Create a new workflow trigger
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TriggerInput'
 *     responses:
 *       '201':
 *         description: Trigger created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowTrigger'
 *       '400': { $ref: '#/components/responses/BadRequest' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '409': { $ref: '#/components/responses/Conflict' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.post('/', async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user!.userId;
        const data = triggerInputSchema.parse({ ...req.body, created_by_user_id: userId });
        const trigger = await createTrigger(data);
        res.status(201).json(trigger);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
        if (error.message.includes('already exists') || error.message.includes('not found')) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating trigger:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @openapi
 * /admin/triggers/{triggerId}:
 *   get:
 *     tags: [Admin - Workflow Triggers]
 *     summary: Get a specific trigger by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TriggerIdPath'
 *     responses:
 *       '200':
 *         description: Trigger details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowTrigger'
 *       '404': { $ref: '#/components/responses/NotFound' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/:triggerId', async (req: express.Request, res: express.Response) => {
    try {
        const trigger = await getTriggerById(req.params.triggerId);
        if (!trigger) {
            return res.status(404).json({ message: "Trigger not found" });
        }
        res.status(200).json(trigger);
    } catch (error: any) {
        console.error("Error fetching trigger by ID:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @openapi
 * /admin/triggers/workflow/{workflowId}:
 *   get:
 *     tags: [Admin - Workflow Triggers]
 *     summary: Get all triggers for a specific workflow ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         description: ID of the workflow to fetch triggers for.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: A list of triggers for the specified workflow.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WorkflowTrigger'
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/workflow/:workflowId', async (req: express.Request, res: express.Response) => {
    try {
        const triggers = await getTriggersByWorkflowId(req.params.workflowId);
        res.status(200).json(triggers);
    } catch (error: any) {
        console.error("Error fetching triggers by workflow ID:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @openapi
 * /admin/triggers/{triggerId}:
 *   put:
 *     tags: [Admin - Workflow Triggers]
 *     summary: Update an existing trigger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TriggerIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TriggerInput'
 *     responses:
 *       '200':
 *         description: Trigger updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkflowTrigger'
 *       '400': { $ref: '#/components/responses/BadRequest' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *       '409': { $ref: '#/components/responses/Conflict' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.put('/:triggerId', async (req: express.Request, res: express.Response) => {
    try {
        const dataToUpdate = triggerUpdateSchema.parse(req.body);
        if (Object.keys(dataToUpdate).length === 0) {
            return res.status(400).json({ message: "No update fields provided." });
        }
        const trigger = await updateTrigger(req.params.triggerId, dataToUpdate);
        if (!trigger) {
            return res.status(404).json({ message: "Trigger not found or update failed" });
        }
        res.status(200).json(trigger);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
         if (error.message.includes('already exists') || error.message.includes('not found')) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error updating trigger:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @openapi
 * /admin/triggers/{triggerId}:
 *   delete:
 *     tags: [Admin - Workflow Triggers]
 *     summary: Delete a trigger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TriggerIdPath'
 *     responses:
 *       '204':
 *         description: Trigger deleted successfully. No content.
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.delete('/:triggerId', async (req: express.Request, res: express.Response) => {
    try {
        const success = await deleteTrigger(req.params.triggerId);
        if (!success) {
            return res.status(404).json({ message: "Trigger not found" });
        }
        res.status(204).send();
    } catch (error: any) {
        console.error("Error deleting trigger:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
