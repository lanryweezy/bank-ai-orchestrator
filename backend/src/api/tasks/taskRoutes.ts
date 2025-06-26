import * as express from 'express';
import { ZodError } from 'zod';
import {
    getTaskById,
    getTasksForUser,
    // completeTask, // Direct completion via API might be complex due to workflow progression
    taskInputSchema // For validating output data primarily
} from '../../services/taskService';
import { processTaskCompletionAndContinueWorkflow } from '../../services/workflowRunService'; // Use this to handle completion
import { authenticateToken, isBankUser } from '../../middleware/authMiddleware';

const router = express.Router();

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

// Other task actions like claim, assign, update_details could be added here.

export default router;
