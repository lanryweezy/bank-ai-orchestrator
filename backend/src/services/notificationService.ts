import { query } from '../config/db';
import { z } from 'zod';

// Basic Notification Type (can be expanded)
export interface Notification {
    notification_id: string;
    user_id: string;
    type: string; // e.g., 'task_assigned', 'workflow_completed', 'mention'
    message: string;
    related_entity_type?: string | null;
    related_entity_id?: string | null;
    is_read: boolean;
    created_at: Date;
    read_at?: Date | null;
    // Potentially include user details if joining, or keep service focused on notification entity
}

// Schema for creating a notification (internal use by other services)
export const createNotificationSchema = z.object({
    user_id: z.string().uuid(),
    type: z.string().min(1).max(50),
    message: z.string().min(1),
    related_entity_type: z.string().max(50).optional().nullable(),
    related_entity_id: z.string().uuid().optional().nullable(),
});
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;


export const createNotification = async (input: CreateNotificationInput): Promise<Notification> => {
    const { user_id, type, message, related_entity_type, related_entity_id } = createNotificationSchema.parse(input);

    const result = await query(
        `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, type, message, related_entity_type, related_entity_id]
    );
    return result.rows[0];
};

export interface GetNotificationsOptions {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
}

export const getNotificationsForUser = async (userId: string, options: GetNotificationsOptions = {}): Promise<Notification[]> => {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    let queryString = 'SELECT * FROM notifications WHERE user_id = $1';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
        queryString += ` AND is_read = false`;
    }

    queryString += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    const result = await query(queryString, queryParams);
    return result.rows;
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
    const result = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
    );
    return parseInt(result.rows[0].count, 10);
};

export const markNotificationAsRead = async (notificationId: string, userId: string): Promise<Notification | null> => {
    // Ensure the notification belongs to the user trying to mark it as read
    const result = await query(
        `UPDATE notifications
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE notification_id = $1 AND user_id = $2 AND is_read = false
         RETURNING *`,
        [notificationId, userId]
    );
    if (result.rows.length === 0) {
        // Could be due to notification not found, already read, or not owned by user
        const checkOwner = await query('SELECT user_id FROM notifications WHERE notification_id = $1', [notificationId]);
        if (checkOwner.rows.length === 0) throw new Error('Notification not found.');
        if (checkOwner.rows[0].user_id !== userId) throw new Error('User not authorized to mark this notification as read.');
        // If it exists and is owned, it must have been already read
    }
    return result.rows[0] || null; // Returns null if already read or not found/authorized
};

export const markAllNotificationsAsRead = async (userId: string): Promise<{ marked_count: number }> => {
    const result = await query(
        `UPDATE notifications
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND is_read = false
         RETURNING notification_id`, // Return IDs to count, or just use rowCount
        [userId]
    );
    return { marked_count: result.rowCount || 0 };
};
