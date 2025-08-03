// backend/src/api/webhookRoutes.ts
import express from 'express';
import { handleWebhookTrigger } from '../services/triggerService';

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Webhooks
 *   description: Endpoints for receiving webhook triggers.
 */

/**
 * @openapi
 * /webhooks/{pathIdentifier}:
 *   all: # Indicates this endpoint accepts ALL HTTP methods, actual method validation is in service
 *     tags: [Webhooks]
 *     summary: Generic webhook receiver
 *     description: >
 *       Receives incoming webhooks based on a unique path identifier.
 *       The associated trigger configuration determines the expected HTTP method,
 *       security validation (HMAC, bearer token), and how the payload is processed
 *       to start a specific workflow.
 *     parameters:
 *       - name: pathIdentifier
 *         in: path
 *         required: true
 *         description: The unique path identifier for the configured webhook trigger.
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Webhook payload (structure depends on the source system). Can be any JSON.
 *       required: false # Some webhooks might be GET with query params, or trigger on call alone
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *         text/plain:
 *           schema:
 *             type: string
 *         application/xml: # Add other common content types if necessary
 *           schema:
 *             type: string
 *         application/x-www-form-urlencoded:
 *            schema:
 *              type: object
 *     responses:
 *       '202':
 *         description: Webhook accepted, workflow run initiation attempted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: 'string' }
 *       '400': { $ref: '#/components/responses/BadRequest' } # e.g. Invalid payload if mapping/validation occurs
 *       '401': { $ref: '#/components/responses/Unauthorized' } # e.g. Missing/invalid security token/signature
 *       '403': { $ref: '#/components/responses/Forbidden' } # e.g. HMAC validation failure
 *       '404': { $ref: '#/components/responses/NotFound' } # Webhook trigger config not found for path
 *       '405':
 *         description: Method Not Allowed (if trigger config expects POST but received GET).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.all('/:pathIdentifier', async (req: express.Request, res: express.Response) => {
    const { pathIdentifier } = req.params;
    const requestPayload = req.body;
    const requestInfo = {
        method: req.method,
        headers: req.headers as Record<string, string | string[] | undefined>,
        // queryParams: req.query, // If needed by trigger logic
        // ipAddress: req.ip // If needed
    };

    try {
        const result = await handleWebhookTrigger(pathIdentifier, requestPayload, requestInfo);
        res.status(result.statusCode).json(result.body);
    } catch (error: any) {
        console.error(`Webhook internal error for path ${pathIdentifier}:`, error);
        res.status(500).json({ error: "Internal server error processing webhook." });
    }
});

export default router;
