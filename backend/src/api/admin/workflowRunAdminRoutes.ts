import express from 'express';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';
import { getTasksForRun } from '../../services/taskService';
import { getWorkflowRunById } from '../../services/workflowRunService';

const router = express.Router();

router.use(authenticateToken, isPlatformAdmin);

/**
 * @openapi
 * tags:
 *   name: Admin - Workflow Runs
 *   description: Manage and inspect Workflow Runs (Admin access required)
 */

/**
 * @openapi
 * /admin/workflow-runs/{runId}/tasks:
 *   get:
 *     tags: [Admin - Workflow Runs]
 *     summary: Get all tasks for a specific workflow run
 *     description: Retrieves a list of all tasks associated with a given workflow run ID. Requires platform_admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: runId
 *         in: path
 *         required: true
 *         description: ID of the workflow run.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: A list of tasks for the workflow run.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404':
 *         description: Workflow run not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/:runId/tasks', async (req, res) => {
    try {
        const { runId } = req.params;

        // Optional: Check if runId itself is valid or exists
        const run = await getWorkflowRunById(runId);
        if (!run) {
            return res.status(404).json({ message: `Workflow run with ID ${runId} not found.`});
        }

        const tasks = await getTasksForRun(runId);
        res.status(200).json(tasks);
    } catch (error) {
        console.error(`Error fetching tasks for run ${req.params.runId}:`, error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
