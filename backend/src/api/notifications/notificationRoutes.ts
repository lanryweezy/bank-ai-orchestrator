import * as express from 'express';
import { z, ZodError } from 'zod';
import * as notificationService from '../../services/notificationService';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * tags:
 *   name: Notifications
 *   description: Manage and retrieve user notifications
 */

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notifications for the authenticated user
 *     description: Retrieves a list of notifications for the logged-in user, with optional pagination and filtering for unread notifications.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of notifications to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip for pagination.
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, only returns unread notifications.
 *     responses:
 *       '200':
 *         description: A list of notifications.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification' # Assuming Notification schema is defined in swaggerConfig
 *       '400':
 *         description: Invalid query parameters.
 *       '500':
 *         description: Internal server error.
 */
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user!.userId;
        const { limit, offset, unreadOnly } = req.query;

        const options: notificationService.GetNotificationsOptions = {};
        if (limit) options.limit = parseInt(limit as string, 10);
        if (offset) options.offset = parseInt(offset as string, 10);
        if (unreadOnly) options.unreadOnly = (unreadOnly === 'true');

        // Validate parsed query params
        if (options.limit !== undefined && (isNaN(options.limit) || options.limit <= 0)) {
            return res.status(400).json({ message: "Invalid 'limit' parameter." });
        }
        if (options.offset !== undefined && (isNaN(options.offset) || options.offset < 0)) {
            return res.status(400).json({ message: "Invalid 'offset' parameter." });
        }

        const notifications = await notificationService.getNotificationsForUser(userId, options);
        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count
 *     description: Retrieves the number of unread notifications for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Count of unread notifications.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unread_count:
 *                   type: integer
 *       '500':
 *         description: Internal server error.
 */
router.get('/unread-count', async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user!.userId;
        const count = await notificationService.getUnreadNotificationCount(userId);
        res.status(200).json({ unread_count: count });
    } catch (error) {
        console.error('Error fetching unread notification count:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /notifications/{notificationId}/read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     description: Marks a specific notification as read for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the notification to mark as read.
 *     responses:
 *       '200':
 *         description: Notification marked as read successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       '403':
 *         description: Forbidden (user cannot mark this notification).
 *       '404':
 *         description: Notification not found.
 *       '500':
 *         description: Internal server error.
 */
router.post('/:notificationId/read', async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user!.userId;
        const { notificationId } = req.params;

        // Validate UUID format for notificationId if needed, though DB will catch it
        // const uuidSchema = z.string().uuid();
        // uuidSchema.parse(notificationId); // Will throw if invalid

        const updatedNotification = await notificationService.markNotificationAsRead(notificationId, userId);
        if (!updatedNotification) {
             // This case should ideally be handled by service throwing specific errors
            const checkNotification = await notificationService.getNotificationsForUser(userId, {limit: 1});
            const targetNotification = checkNotification.find(n => n.notification_id === notificationId);
            if(!targetNotification) return res.status(404).json({ message: 'Notification not found or not owned by user.' });
            if(targetNotification.is_read) return res.status(200).json(targetNotification); // Already read
        }
        res.status(200).json(updatedNotification);
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('not authorized')) {
            return res.status(403).json({ message: error.message });
        }
        // if (error instanceof ZodError) { // For UUID validation if added
        //     return res.status(400).json({ message: 'Invalid notification ID format.', errors: error.errors });
        // }
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all unread notifications as read
 *     description: Marks all unread notifications for the authenticated user as read.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: All unread notifications marked as read.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 marked_count:
 *                   type: integer
 *       '500':
 *         description: Internal server error.
 */
router.post('/read-all', async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user!.userId;
        const result = await notificationService.markAllNotificationsAsRead(userId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
