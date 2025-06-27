import * as express from 'express';
import { ZodError } from 'zod';
import {
  agentTemplateSchema,
  createAgentTemplate,
  getAllAgentTemplates,
  getAgentTemplateById,
  updateAgentTemplate,
  deleteAgentTemplate
} from '../../services/agentTemplateService';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';

const router = express.Router();

// All routes in this file are protected and require platform_admin role
router.use(authenticateToken, isPlatformAdmin);

/**
 * @openapi
 * tags:
 *   name: Admin - Agent Templates
 *   description: Manage Agent Templates (Admin access required)
 */

/**
 * @openapi
 * /admin/agent-templates:
 *   post:
 *     tags: [Admin - Agent Templates]
 *     summary: Create a new agent template
 *     description: Adds a new agent template to the system. Requires platform_admin role.
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
 *         description: Invalid input data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized.
 *       '403':
 *         description: Forbidden (user is not a platform_admin).
 *       '409':
 *         description: Conflict (e.g., template name already exists).
 *       '500':
 *         description: Internal server error.
 */
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const data = agentTemplateSchema.parse(req.body);
    const newTemplate = await createAgentTemplate(data);
    res.status(201).json(newTemplate);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    // Handle potential unique constraint errors from DB, e.g., duplicate name
    if (error.code === '23505' && error.constraint === 'agent_templates_name_key') {
        return res.status(409).json({ message: `Agent template with name '${req.body.name}' already exists.`});
    }
    console.error('Error creating agent template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /admin/agent-templates:
 *   get:
 *     tags: [Admin - Agent Templates]
 *     summary: List all agent templates (admin)
 *     description: Retrieves a comprehensive list of all agent templates. Requires platform_admin role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A list of all agent templates.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AgentTemplate'
 *       '401':
 *         description: Unauthorized.
 *       '403':
 *         description: Forbidden.
 *       '500':
 *         description: Internal server error.
 */
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const templates = await getAllAgentTemplates(); // Service function already gets all
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching all agent templates for admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /admin/agent-templates/{templateId}:
 *   get:
 *     tags: [Admin - Agent Templates]
 *     summary: Get a specific agent template by ID (admin)
 *     description: Retrieves details of a specific agent template by its ID. Requires platform_admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the agent template to retrieve.
 *     responses:
 *       '200':
 *         description: Agent template details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentTemplate'
 *       '404':
 *         description: Agent template not found.
 *       '401':
 *         description: Unauthorized.
 *       '403':
 *         description: Forbidden.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:templateId', async (req: express.Request, res: express.Response) => {
  try {
    const template = await getAgentTemplateById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ message: 'Agent template not found' });
    }
    res.status(200).json(template);
  } catch (error) {
    console.error('Error fetching agent template by ID for admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /admin/agent-templates/{templateId}:
 *   put:
 *     tags: [Admin - Agent Templates]
 *     summary: Update an existing agent template
 *     description: Modifies an existing agent template. Requires platform_admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the agent template to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentTemplateInput'
 *     responses:
 *       '200':
 *         description: Agent template updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentTemplate'
 *       '400':
 *         description: Invalid input data.
 *       '404':
 *         description: Agent template not found.
 *       '401':
 *         description: Unauthorized.
 *       '403':
 *         description: Forbidden.
 *       '409':
 *         description: Conflict (e.g., template name already exists for another record).
 *       '500':
 *         description: Internal server error.
 */
router.put('/:templateId', async (req: express.Request, res: express.Response) => {
  try {
    // agentTemplateSchema will validate the entire object for replacement.
    // For partial updates, use agentTemplateSchema.partial().
    // Given it's an admin UI form, full update is acceptable.
    const data = agentTemplateSchema.parse(req.body);
    const updatedTemplate = await updateAgentTemplate(req.params.templateId, data);
    if (!updatedTemplate) {
      return res.status(404).json({ message: 'Agent template not found or update failed' });
    }
    res.status(200).json(updatedTemplate);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.code === '23505' && error.constraint === 'agent_templates_name_key') {
        return res.status(409).json({ message: `Agent template with name '${req.body.name}' already exists for another template.`});
    }
    console.error('Error updating agent template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /admin/agent-templates/{templateId}:
 *   delete:
 *     tags: [Admin - Agent Templates]
 *     summary: Delete an agent template
 *     description: Removes an agent template from the system. Requires platform_admin role.
 *                  Caution: This can affect configured agents using this template.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the agent template to delete.
 *     responses:
 *       '200':
 *         description: Agent template deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 template:
 *                   $ref: '#/components/schemas/AgentTemplate'
 *       '404':
 *         description: Agent template not found.
 *       '401':
 *         description: Unauthorized.
 *       '403':
 *         description: Forbidden.
 *       '409':
 *         description: Conflict - template in use by configured agents.
 *       '500':
 *         description: Internal server error.
 */
router.delete('/:templateId', async (req: express.Request, res: express.Response) => {
  try {
    // Future enhancement: Check if the template is used by any configured_agents.
    // const configuredAgents = await query('SELECT 1 FROM configured_agents WHERE template_id = $1 LIMIT 1', [req.params.templateId]);
    // if (configuredAgents.rows.length > 0) {
    //   return res.status(409).json({ message: 'Conflict: Agent template is currently in use by configured agents and cannot be deleted.' });
    // }

    const deletedTemplate = await deleteAgentTemplate(req.params.templateId);
    if (!deletedTemplate) {
      return res.status(404).json({ message: 'Agent template not found' });
    }
    res.status(200).json({ message: 'Agent template deleted successfully', template: deletedTemplate });
  } catch (error: any) {
    // Handle foreign key constraint violation if a configured agent still uses this template
    // The specific error code and constraint name might vary slightly by PostgreSQL version or exact schema.
    // '23503' is foreign_key_violation. 'configured_agents_template_id_fkey' is the typical constraint name.
    if (error.code === '23503' && error.constraint === 'configured_agents_template_id_fkey') {
        return res.status(409).json({
            message: 'Conflict: This agent template is currently in use by one or more configured agents. Please delete or reassign those agents before deleting this template.'
        });
    }
    console.error('Error deleting agent template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
