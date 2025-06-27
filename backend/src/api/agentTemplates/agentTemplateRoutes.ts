import * as express from 'express';
import { getAllAgentTemplates, getAgentTemplateById } from '../../services/agentTemplateService';
import { authenticateToken } from '../../middleware/authMiddleware'; // All users can list/view templates

const router = express.Router();

// All routes here are authenticated
router.use(authenticateToken);

/**
 * @openapi
 * tags:
 *   name: Agent Templates
 *   description: Access to available Agent Templates
 */

/**
 * @openapi
 * /agent-templates:
 *   get:
 *     tags: [Agent Templates]
 *     summary: List all available agent templates
 *     description: Retrieves a list of all agent templates that can be used to configure new agents.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A list of agent templates.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AgentTemplate'
 *       '401':
 *         description: Unauthorized (token missing or invalid).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const templates = await getAllAgentTemplates();
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching agent templates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/agent-templates/:templateId - Get a specific agent template by ID
router.get('/:templateId', async (req: express.Request, res: express.Response) => {
  try {
    const template = await getAgentTemplateById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ message: 'Agent template not found' });
    }
    res.status(200).json(template);
  } catch (error) {
    console.error('Error fetching agent template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
