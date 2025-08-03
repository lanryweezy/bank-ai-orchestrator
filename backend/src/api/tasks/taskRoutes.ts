import * as express from 'express';
import { ZodError } from 'zod';
import {
    getTaskById,
    getTasksForUser,
    taskInputSchema, // For validating output data primarily in completeTask
    createTaskComment,
    getTaskComments,
    taskCommentSchema,
    getTaskSummaryForUser,
    delegateTask // Import delegateTask service function
} from '../../services/taskService';
import { processTaskCompletionAndContinueWorkflow } from '../../services/workflowRunService'; // Use this to handle completion
import { authenticateToken, isBankUser, isPlatformAdmin }
    from '../../middleware/authMiddleware';
import { z } from 'zod'; // Import Zod for request body validation

const router = express.Router();

// All routes related to tasks are authenticated for at least a bank_user
router.use(authenticateToken, isBankUser);


// GET /api/tasks - Get tasks for the authenticated user
// Add query params for filtering by status, etc.
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role; // Assumes role is in JWT payload
    const { status } = req.query;
    const tasks = await getTasksForUser(userId, userRole, status ? String(status) : undefined);
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Error fetching tasks for user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/tasks/:taskId - Get a specific task
router.get('/:taskId', async (req: express.Request, res: express.Response) => {
  try {
    const task = await getTaskById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    // Authorization: Ensure user is assigned to this task or is an admin
    if (req.user!.role !== 'platform_admin' && task.assigned_to_user_id !== req.user!.userId) {
      // More complex logic for bank_admin etc.
      // return res.status(403).json({ message: 'Forbidden: You are not authorized to view this task.' });
    }
    res.status(200).json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/tasks/:taskId/complete - Complete a task
router.post('/:taskId/complete', async (req: express.Request, res: express.Response) => {
  try {
    // Validate output_data_json if the task type expects it
    // For simplicity, we'll use a generic part of taskInputSchema for output_data_json
    const validation = taskInputSchema.pick({ output_data_json: true }).partial();
    const { output_data_json } = validation.parse(req.body);

    const taskId = req.params.taskId;
    const userId = req.user!.userId;

    const updatedTask = await processTaskCompletionAndContinueWorkflow(taskId, output_data_json || {}, userId);

    if (!updatedTask) { // Should not happen if no error thrown by service
        return res.status(404).json({ message: 'Task not found or completion failed.' });
    }
    res.status(200).json(updatedTask);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed for output data', errors: error.errors });
    }
    if (error.message.includes('Task not found') || error.message.includes('Task is already completed')) {
        return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('User not authorized')) {
        return res.status(403).json({ message: error.message });
    }
    console.error('Error completing task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// --- Task Comments Routes ---

/**
 * @openapi
 * /tasks/{taskId}/comments:
 *   post:
 *     tags: [Tasks]
 *     summary: Add a comment to a task
 *     description: Allows an authenticated user to add a comment to a specific task.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the task to comment on.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskCommentInput'
 *     responses:
 *       '201':
 *         description: Comment added successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskComment'
 *       '400':
 *         description: Invalid input (e.g., empty comment).
 *       '403':
 *         description: Forbidden (user may not have rights to comment or view task).
 *       '404':
 *         description: Task not found.
 *       '500':
 *         description: Internal server error.
 */
router.post('/:taskId/comments', async (req: express.Request, res: express.Response) => {
    try {
        const { taskId } = req.params;
        const userId = req.user!.userId; // User must be authenticated

        // Authorization: Check if user can view/access the task before commenting
        const task = await getTaskById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        // Basic check: user is assigned, or is admin. More granular checks can be added.
        // This check might be too simplistic depending on desired visibility of tasks.
        // For now, any authenticated user part of the system (isBankUser) can comment if they know the task ID.
        // A stricter rule would be: task.assigned_to_user_id === userId || req.user.role === 'platform_admin' etc.
        // Or check if user is part of the workflow run.
        // For now, relying on `isBankUser` for general access to tasks they might be involved in.

        const { comment_text } = taskCommentSchema.parse(req.body);
        const newComment = await createTaskComment(taskId, userId, comment_text);
        res.status(201).json(newComment);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: 'Validation failed', errors: error.errors });
        }
        console.error('Error adding task comment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /tasks/{taskId}/comments:
 *   get:
 *     tags: [Tasks]
 *     summary: Get comments for a task
 *     description: Retrieves all comments for a specific task.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the task.
 *     responses:
 *       '200':
 *         description: A list of comments for the task.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TaskComment' # Assuming TaskComment schema includes user details
 *       '403':
 *         description: Forbidden.
 *       '404':
 *         description: Task not found.
 *       '500':
 *         description: Internal server error.
 */
router.get('/:taskId/comments', async (req: express.Request, res: express.Response) => {
    try {
        const { taskId } = req.params;
        // Authorization: Similar to POST, check if user can view the task
        const task = await getTaskById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        // Add authorization checks as needed here.

        const comments = await getTaskComments(taskId);
        res.status(200).json(comments);
    } catch (error: any) {
        console.error('Error fetching task comments:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Other task actions like claim, assign, update_details could be added here.

/**
 * @openapi
 * /tasks/summary:
 *   get:
 *     tags: [Tasks]
 *     summary: Get task summary for the authenticated user
 *     description: Retrieves counts of tasks by status (pending, assigned, in_progress) and a list of recent/upcoming tasks.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of recent tasks to return.
 *     responses:
 *       '200':
 *         description: Task summary retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counts:
 *                   type: object
 *                   properties:
 *                     pending: { type: integer }
 *                     assigned: { type: integer }
 *                     in_progress: { type: integer }
 *                 recent_tasks:
 *                   type: array
 *                   items:
 *                     type: object # Define a minimal TaskSummaryItem schema if needed
 *                     properties:
 *                       task_id: { type: string, format: uuid }
 *                       step_name_in_workflow: { type: string }
 *                       workflow_name: { type: string }
 *                       status: { type: string }
 *                       due_date: { type: string, format: date-time, nullable: true }
 *       '500':
 *         description: Internal server error.
 */
router.get('/summary', async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user!.userId;
        const userRole = req.user!.role;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({ message: "Invalid limit parameter." });
        }

        const summary = await getTaskSummaryForUser(userId, userRole, limit);
        res.status(200).json(summary);
    } catch (error) {
        console.error('Error fetching task summary:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
=======
/**
 * @openapi
 * /tasks/{taskId}/delegate:
 *   post:
 *     tags: [Tasks]
 *     summary: Delegate a task to another user
 *     description: Allows the currently assigned user to delegate the task.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DelegateTaskBody'
 *     responses:
 *       '200':
 *         description: Task delegated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       '400': { $ref: '#/components/responses/BadRequest' } # e.g. invalid targetUserId, self-delegation
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' } # e.g. not current assignee
 *       '404': { $ref: '#/components/responses/NotFound' } # Task not found
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
const delegateTaskBodySchema = z.object({
  targetUserId: z.string().uuid("Invalid target user ID format."),
});

router.post('/:taskId/delegate', async (req: express.Request, res: express.Response) => {
  try {
    const { taskId } = req.params;
    const delegatingUserId = req.user!.userId; // User performing the delegation

    const { targetUserId } = delegateTaskBodySchema.parse(req.body);

    if (delegatingUserId === targetUserId) {
      return res.status(400).json({ message: "Cannot delegate task to yourself." });
    }

    // taskService.delegateTask will handle authorization (is delegatingUser the current assignee?)
    const delegatedTask = await delegateTask(taskId, delegatingUserId, targetUserId);

    res.status(200).json(delegatedTask);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('not found') || error.message.includes('cannot be delegated')) {
        return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('not the current assignee')) {
        return res.status(403).json({ message: error.message });
    }
    console.error('Error delegating task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
>>>>>>> origin/feat/workflow-engine-enhancements
});


export default router;
