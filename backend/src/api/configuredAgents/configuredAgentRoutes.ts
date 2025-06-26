import * as express from 'express';
import { ZodError } from 'zod';
import {
  configuredAgentSchema,
  createConfiguredAgent,
  getAllConfiguredAgents,
  getConfiguredAgentById,
  updateConfiguredAgent,
  deleteConfiguredAgent,
  executeAgent
} from '../../services/configuredAgentService';
import { authenticateToken, isBankUser } from '../../middleware/authMiddleware'; // Assuming isBankUser for general ops

const router = express.Router();

// All routes here are authenticated and require at least bank_user role
router.use(authenticateToken, isBankUser);

// POST /api/configured-agents - Create a new configured agent
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const data = configuredAgentSchema.parse(req.body);
    if (!req.user?.userId) { // Should be set by authenticateToken
        return res.status(403).json({ message: 'User ID not found in token' });
    }
    const agent = await createConfiguredAgent(data, req.user.userId);
    res.status(201).json(agent);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    // Add more specific error handling, e.g., if template_id does not exist
    if (error.message.includes('violates foreign key constraint "configured_agents_template_id_fkey"')) {
        return res.status(400).json({ message: 'Invalid template_id: Agent template not found.' });
    }
    console.error('Error creating configured agent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/configured-agents - List configured agents for the user/bank
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    // Depending on roles, filter by user_id or allow platform_admin to see all (not implemented here yet)
    const agents = await getAllConfiguredAgents(req.user?.userId);
    res.status(200).json(agents);
  } catch (error) {
    console.error('Error fetching configured agents:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/configured-agents/:agentId - Get a specific configured agent
router.get('/:agentId', async (req: express.Request, res: express.Response) => {
  try {
    const agent = await getConfiguredAgentById(req.params.agentId, req.user?.userId);
    if (!agent) {
      return res.status(404).json({ message: 'Configured agent not found or access denied' });
    }
    res.status(200).json(agent);
  } catch (error) {
    console.error('Error fetching configured agent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/configured-agents/:agentId - Update a configured agent
router.put('/:agentId', async (req: express.Request, res: express.Response) => {
  try {
    const data = configuredAgentSchema.partial().parse(req.body);
     if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No update fields provided." });
    }
    if (!req.user?.userId) {
        return res.status(403).json({ message: 'User ID not found in token' });
    }
    // The service function `updateConfiguredAgent` already checks for user_id match for non-admins
    const agent = await updateConfiguredAgent(req.params.agentId, data, req.user.userId);
    if (!agent) {
      return res.status(404).json({ message: 'Configured agent not found or update failed (access denied/no changes)' });
    }
    res.status(200).json(agent);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('violates foreign key constraint "configured_agents_template_id_fkey"')) {
        return res.status(400).json({ message: 'Invalid template_id: Agent template not found.' });
    }
    console.error('Error updating configured agent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/configured-agents/:agentId - Delete a configured agent
router.delete('/:agentId', async (req: express.Request, res: express.Response) => {
  try {
    if (!req.user?.userId) {
        return res.status(403).json({ message: 'User ID not found in token' });
    }
    // The service function `deleteConfiguredAgent` already checks for user_id match
    const agent = await deleteConfiguredAgent(req.params.agentId, req.user.userId);
    if (!agent) {
      return res.status(404).json({ message: 'Configured agent not found or access denied' });
    }
    // TODO: Consider implications if this agent is part of active workflow_runs or tasks.
    // The DB schema for tasks.assigned_to_agent_id does not have ON DELETE constraints yet.
    res.status(200).json({ message: 'Configured agent deleted successfully', agent });
  } catch (error: any) {
    console.error('Error deleting configured agent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/configured-agents/{agentId}/execute - Placeholder for agent execution
// Note: In a real system, agent execution is likely triggered by the workflow engine, not directly via API like this by end-users.
// This is more for testing or specific direct invocation scenarios.
router.post('/:agentId/execute', async (req: express.Request, res: express.Response) => {
    try {
        // Basic authorization: ensure user can access/knows about this agent
        const agentReadable = await getConfiguredAgentById(req.params.agentId, req.user?.userId);
        if (!agentReadable) {
            return res.status(404).json({ message: 'Configured agent not found or access denied' });
        }

        const inputData = req.body.input_data || {}; // Agent execution might require specific input
        const result = await executeAgent(req.params.agentId, inputData);
        res.status(200).json(result);
    } catch (error: any) {
        console.error(`Error executing agent ${req.params.agentId}:`, error);
        if (error.message.includes('Configured agent not found')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during agent execution' });
    }
});


export default router;
