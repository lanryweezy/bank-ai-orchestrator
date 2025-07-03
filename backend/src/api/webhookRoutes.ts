// backend/src/api/webhookRoutes.ts
import express from 'express';
import { handleWebhookTrigger } from '../services/triggerService';

const router = express.Router();

// Generic webhook endpoint.
// Using .all to capture all methods and let the service validate.
// IMPORTANT: Ensure express.json() or other body parsing middleware runs *before* this route
// if the triggerService.handleWebhookTrigger expects a parsed req.body.
// For HMAC on raw body, a different setup would be needed (e.g. express.raw()).
router.all('/:pathIdentifier', async (req: express.Request, res: express.Response) => {
    const { pathIdentifier } = req.params;
    const requestPayload = req.body; // Assumes body is parsed (e.g., by express.json())
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
