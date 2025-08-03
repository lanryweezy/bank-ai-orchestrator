import * as express from 'express';
import { ZodError } from 'zod';
import {
    getTaskById,
    getTasksForUser,
    taskInputSchema, // For validating output data primarily in completeTask
    createTaskComment,
    getTaskComments,
    taskCommentSchema
} from '../../services/taskService';
import { processTaskCompletionAndContinueWorkflow } from '../../services/workflowRunService'; // Use this to handle completion
import { authenticateToken, isBankUser, isPlatformAdmin } // Assuming isBankUser for general task ops
    from '../../middleware/authMiddleware';

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

    await processTaskCompletionAndContinueWorkflow(taskId, output_data_json || {}, userId);
    
    // Get the updated task after completion
    const updatedTask = await getTaskById(taskId);
    if (!updatedTask) {
        return res.status(404).json({ message: 'Task not found after completion.' });
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

export default router;
