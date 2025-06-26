import * as express from 'express';
import { ZodError } from 'zod';
import { agentTemplateSchema, createAgentTemplate, updateAgentTemplate, deleteAgentTemplate, getAgentTemplateById } from '../../services/agentTemplateService';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Agent Templates (Admin)
 *   description: Administration of Agent Templates (requires platform_admin role)
 */
router.use(authenticateToken, isPlatformAdmin); // Apply to all routes in this file

/**
 * @openapi
 * /admin/agent-templates:
 *   post:
 *     tags: [Agent Templates (Admin)]
 *     summary: Create a new agent template
 *     description: Allows platform admins to define new agent templates.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentTemplateInput'
 *     responses:
 *       '201':
 *         description: Agent template created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentTemplate'
 *       '400':
 *         description: Validation failed or invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (token missing or invalid).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden (user does not have platform_admin role).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: Conflict (e.g., template with this name already exists).
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
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const data = agentTemplateSchema.parse(req.body);
    const template = await createAgentTemplate(data);
    res.status(201).json(template);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('duplicate key value violates unique constraint "agent_templates_name_key"')) {
        return res.status(409).json({ message: 'Agent template with this name already exists.' });
    }
    console.error('Error creating agent template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/admin/agent-templates/:templateId - Update an agent template
router.put('/:templateId', async (req: express.Request, res: express.Response) => {
  try {
    const data = agentTemplateSchema.partial().parse(req.body); // Allow partial updates
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No update fields provided." });
    }
    const template = await updateAgentTemplate(req.params.templateId, data);
    if (!template) {
      return res.status(404).json({ message: 'Agent template not found' });
    }
    res.status(200).json(template);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('duplicate key value violates unique constraint "agent_templates_name_key"')) {
        return res.status(409).json({ message: 'Agent template with this name already exists.' });
    }
    console.error('Error updating agent template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/agent-templates/:templateId - Delete an agent template
router.delete('/:templateId', async (req: express.Request, res: express.Response) => {
  try {
    const template = await deleteAgentTemplate(req.params.templateId);
    if (!template) {
      return res.status(404).json({ message: 'Agent template not found' });
    }
    // Check for configured_agents using this template before deleting? Or handle with DB constraints (ON DELETE RESTRICT)
    // For now, simple delete. DB schema for configured_agents.template_id does not have ON DELETE CASCADE/SET NULL.
    // It has `REFERENCES agent_templates(template_id)` which defaults to ON DELETE RESTRICT.
    // So, if any configured_agent uses it, this delete will fail at DB level.
    res.status(200).json({ message: 'Agent template deleted successfully', template });
  } catch (error: any) {
     if (error.message.includes('violates foreign key constraint "configured_agents_template_id_fkey"')) {
        return res.status(409).json({ message: 'Cannot delete template: It is currently in use by configured agents.' });
    }
    console.error('Error deleting agent template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/admin/agent-templates/:templateId - Get a specific template (admin view, might be same as public)
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
