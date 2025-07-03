// backend/src/api/admin/triggerAdminRoutes.ts
import express from 'express';
import { ZodError } from 'zod';
import { authenticateToken, isPlatformAdmin } from '../../middleware/authMiddleware';
import {
    triggerInputSchema,
    createTrigger,
    getTriggerById,
    updateTrigger,
    deleteTrigger,
    getTriggersByWorkflowId,
    ScheduledConfig, // Import config types for casting/validation aid
    WebhookConfig    // Import config types for casting/validation aid
    // May add getAllTriggers(filters) from service later if needed for a general admin list
} from '../../services/triggerService';

const router = express.Router();

// Protect all routes in this file
router.use(authenticateToken, isPlatformAdmin);

// Create a new trigger
router.post('/', async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user!.userId; // From authenticateToken
        const data = triggerInputSchema.parse({ ...req.body, created_by_user_id: userId });

        // The refine in triggerInputSchema should handle config validation based on type.
        // Explicit casting here is mostly for type safety if accessing specific config fields post-parse.
        if (data.type === 'scheduled') {
            // data.configuration_json is already validated as ScheduledConfig by Zod refine
        } else if (data.type === 'webhook') {
            // data.configuration_json is already validated as WebhookConfig by Zod refine
        }
        // TODO: Handle event_bus config validation if it becomes more structured

        const trigger = await createTrigger(data);
        // TODO: If it's a 'scheduled' trigger and is_enabled, inform scheduler to load/update it.
        // This requires a mechanism to communicate with the running scheduler instance.
        // For now, scheduler loads on startup. Updates/new triggers might need restart or dynamic loading.
        res.status(201).json(trigger);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
        if (error.message.includes('already exists') || error.message.includes('not found')) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating trigger:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get a trigger by ID
router.get('/:triggerId', async (req: express.Request, res: express.Response) => {
    try {
        const trigger = await getTriggerById(req.params.triggerId);
        if (!trigger) {
            return res.status(404).json({ message: "Trigger not found" });
        }
        res.status(200).json(trigger);
    } catch (error: any) {
        console.error("Error fetching trigger by ID:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get triggers for a specific workflow ID
router.get('/workflow/:workflowId', async (req: express.Request, res: express.Response) => {
    try {
        const triggers = await getTriggersByWorkflowId(req.params.workflowId);
        res.status(200).json(triggers);
    } catch (error: any) {
        console.error("Error fetching triggers by workflow ID:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// Update a trigger
router.put('/:triggerId', async (req: express.Request, res: express.Response) => {
    try {
        // created_by_user_id should not be updatable via this route.
        // The service's updateTrigger function already omits it from direct update.
        // We only pass fields that are allowed to be changed.
        const dataToUpdate = triggerInputSchema.partial().omit({ created_by_user_id: true }).parse(req.body);

        if (Object.keys(dataToUpdate).length === 0) {
            return res.status(400).json({ message: "No update fields provided." });
        }

        const trigger = await updateTrigger(req.params.triggerId, dataToUpdate);
        if (!trigger) {
            return res.status(404).json({ message: "Trigger not found or update failed" });
        }
        // TODO: If a 'scheduled' trigger's cron_string, timezone, or is_enabled status changes,
        // the running scheduler needs to be updated (stop old job, start new one).
        // This is a complex part of dynamic scheduler management.
        res.status(200).json(trigger);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
         if (error.message.includes('already exists') || error.message.includes('not found')) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error updating trigger:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Delete a trigger
router.delete('/:triggerId', async (req: express.Request, res: express.Response) => {
    try {
        const success = await deleteTrigger(req.params.triggerId);
        if (!success) {
            return res.status(404).json({ message: "Trigger not found" });
        }
        // TODO: If a 'scheduled' trigger is deleted, its corresponding cron job should be stopped.
        res.status(204).send(); // No content
    } catch (error: any) {
        console.error("Error deleting trigger:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
