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

export default router;
