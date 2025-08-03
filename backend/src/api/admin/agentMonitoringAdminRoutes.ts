import * as express from 'express';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';
import {
    getAgentStatusCounts,
    getRecentlyActiveAgents,
    getAgentsInErrorState
} from '../../services/configuredAgentService'; // Assuming functions are in configuredAgentService

const router = express.Router();

// All routes here are for platform admins
router.use(authenticateToken, isPlatformAdmin);

/**
 * @openapi
 * tags:
 *   name: Admin - Agent Monitoring
 *   description: Endpoints for monitoring configured agent instances (Admin access required)
 */

/**
 * @openapi
 * /admin/agents/monitoring-summary:
 *   get:
 *     tags: [Admin - Agent Monitoring]
 *     summary: Get a summary of agent statuses and activity
 *     description: Retrieves counts of agents by status, a list of recently active agents, and agents in an error state. Requires platform_admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: recent_agents_limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of recently active agents to return.
 *     responses:
 *       '200':
 *         description: Agent monitoring summary retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status_counts:
 *                   type: object
 *                   properties:
 *                     active: { type: integer }
 *                     inactive: { type: integer }
 *                     error: { type: integer }
 *                     total: { type: integer }
 *                 recently_active_agents:
 *                   type: array
 *                   items: # Define structure for a recently active agent item
 *                     type: object
 *                     properties:
 *                       agent_id: { type: string, format: uuid }
 *                       bank_specific_name: { type: string }
 *                       template_name: { type: string }
 *                       status: { type: string }
 *                       last_task_activity: { type: string, format: date-time }
 *                 error_state_agents:
 *                   type: array
 *                   items: # Define structure for an error state agent item
 *                     type: object
 *                     properties:
 *                       agent_id: { type: string, format: uuid }
 *                       bank_specific_name: { type: string }
 *                       template_name: { type: string }
 *                       status: { type: string }
 *                       last_config_update: { type: string, format: date-time }
 *       '400':
 *         description: Invalid query parameters.
 *       '500':
 *         description: Internal server error.
 */
router.get('/monitoring-summary', async (req: express.Request, res: express.Response) => {
    try {
        const recentAgentsLimit = req.query.recent_agents_limit ? parseInt(req.query.recent_agents_limit as string, 10) : 5;

        if (isNaN(recentAgentsLimit) || recentAgentsLimit <= 0) {
            return res.status(400).json({ message: "Invalid 'recent_agents_limit' parameter." });
        }

        // For platform admin, userId is not passed to service functions to get platform-wide data
        const statusCounts = await getAgentStatusCounts();
        const recentlyActive = await getRecentlyActiveAgents(recentAgentsLimit);
        const errorStateAgents = await getAgentsInErrorState();

        res.status(200).json({
            status_counts: statusCounts,
            recently_active_agents: recentlyActive,
            error_state_agents: errorStateAgents
        });

    } catch (error) {
        console.error('Error fetching agent monitoring summary:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
