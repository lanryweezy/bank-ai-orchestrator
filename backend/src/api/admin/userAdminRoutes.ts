import express from 'express';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';
import { query } from '../../config/db';

const router = express.Router();

router.use(authenticateToken, isPlatformAdmin); // Only platform admins can list all users for now

/**
 * @openapi
 * tags:
 *   name: Admin - Users
 *   description: User management (Admin access required)
 */

/**
 * @openapi
 * /admin/users/list:
 *   get:
 *     tags: [Admin - Users]
 *     summary: List users for selection
 *     description: Retrieves a list of users, typically for populating dropdowns or selection UIs.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user_id:
 *                     type: string
 *                     format: uuid
 *                   username:
 *                     type: string
 *                   full_name:
 *                     type: string
 *                     nullable: true
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.get('/list', async (req, res) => {
    try {
        // For simplicity, returning all users. Add search/pagination in a real app.
        const result = await query('SELECT user_id, username, full_name FROM users ORDER BY username ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching user list for admin:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
