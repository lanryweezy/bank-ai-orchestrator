import * as express from 'express';
import {
    getAllWorkflowRuns,
    getWorkflowRunById
} from '../../services/workflowRunService';
import { authenticateToken, isBankUser, isPlatformAdmin } from '../../middleware/authMiddleware'; // Define roles as needed

const router = express.Router();

router.use(authenticateToken);

// GET /api/workflow-runs - List workflow runs
// Add query params for filtering by status, workflow_id, etc.
router.get('/', isBankUser, async (req: express.Request, res: express.Response) => {
  try {
    const { workflowId, status } = req.query;
    let filters: {workflowId?: string, status?: string, userId?: string} = {};

    if (workflowId) filters.workflowId = String(workflowId);
    if (status) filters.status = String(status);

    // Non-platform_admins should only see their own triggered runs, or runs related to their bank.
    // For simplicity, if not platform_admin, filter by triggering_user_id.
    // A more complex setup might involve bank_id or group membership.
    if (req.user && req.user.role !== 'platform_admin') {
        filters.userId = req.user.userId;
    }

    const runs = await getAllWorkflowRuns(filters);
    res.status(200).json(runs);
  } catch (error) {
    console.error('Error fetching workflow runs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/workflow-runs/:runId - Get a specific workflow run
router.get('/:runId', isBankUser, async (req: express.Request, res: express.Response) => {
  try {
    const run = await getWorkflowRunById(req.params.runId);
    if (!run) {
      return res.status(404).json({ message: 'Workflow run not found' });
    }
    // Add authorization: ensure user is allowed to see this run
    if (req.user && req.user.role !== 'platform_admin' && run.triggering_user_id !== req.user.userId) {
        // More complex logic for bank_admin seeing all bank runs etc. would go here.
        // return res.status(403).json({ message: 'Forbidden: You are not authorized to view this workflow run.' });
    }
    res.status(200).json(run);
  } catch (error) {
    console.error('Error fetching workflow run:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Potentially add routes for cancelling a run, retrying a failed step, etc. later.

/**
 * @openapi
 * /workflow-runs/summary:
 *   get:
 *     tags: [Workflow Runs]
 *     summary: Get summary of recent workflow runs for the user
 *     description: Retrieves a list of recent workflow runs relevant to the authenticated user. Platform admins see all recent runs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of recent runs to return.
 *     responses:
 *       '200':
 *         description: Workflow run summary retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object # Define a minimal WorkflowRunSummaryItem schema
 *                 properties:
 *                   run_id: { type: string, format: uuid }
 *                   workflow_name: { type: string }
 *                   status: { type: string }
 *                   start_time: { type: string, format: date-time }
 *                   current_step_name: {type: string, nullable: true }
 *                   triggering_username: {type: string, nullable: true }
 *       '500':
 *         description: Internal server error.
 */
router.get('/summary', isBankUser, async (req: express.Request, res: express.Response) => { // Applied isBankUser middleware here
    try {
        const userId = req.user!.userId;
        const userRole = req.user!.role;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({ message: "Invalid limit parameter." });
        }

        let runs;
        if (userRole === 'platform_admin') {
            runs = await getAllRecentWorkflowRuns(limit);
        } else {
            runs = await getRecentWorkflowRunsForUser(userId, limit);
        }

        res.status(200).json(runs);
    } catch (error) {
        console.error('Error fetching workflow run summary:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;
