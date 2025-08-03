// backend/src/services/triggerService.ts
import { query } from '../config/db';
import { z } from 'zod';
import { getWorkflowDefinitionById } from './workflowService'; // To validate workflow_id

// Zod schema for Trigger Configuration (varies by type)
const scheduledConfigSchema = z.object({
  cron_string: z.string().min(9).describe("Standard cron string, e.g., '0 * * * *' for hourly."),
  timezone: z.string().optional().default('UTC').describe("Timezone for cron execution, e.g., 'America/New_York'."),
  default_payload: z.record(z.any()).optional().describe("Default payload to start the workflow with."),
});
export type ScheduledConfig = z.infer<typeof scheduledConfigSchema>;

const webhookConfigSchema = z.object({
  path_identifier: z.string().min(5).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Path can only contain alphanumeric, underscore, and hyphen.").describe("Unique path segment for the webhook URL."),
  method: z.enum(['POST', 'GET', 'PUT']).default('POST'), // Add more methods if needed
  security: z.object({
    type: z.enum(['none', 'hmac_sha256', 'bearer_token']), // 'none' for no auth, 'hmac' for signature check, 'bearer' for static token
    secret_env_var: z.string().optional().describe("Environment variable name holding the HMAC secret or bearer token."),
    header_name: z.string().optional().default('X-Signature-256').describe("Header for HMAC signature or 'Authorization' for bearer."),
  }).optional().default({ type: 'none' }),
  payload_mapping_jq: z.string().optional().default('.').describe("JQ expression to transform/select incoming payload. '.' means use whole body."),
});
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;


// Base Trigger Input (for creation and update)
export const triggerInputSchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().optional().nullable(),
  workflow_id: z.string().uuid("Invalid workflow ID format."),
  type: z.enum(['scheduled', 'webhook', 'event_bus']), // For now, only 'scheduled' and 'webhook' fully defined
  configuration_json: z.union([scheduledConfigSchema, webhookConfigSchema, z.record(z.any())]), // Allow generic for event_bus for now
  is_enabled: z.boolean().optional().default(true),
  created_by_user_id: z.string().uuid(), // Should be set by the system from authenticated user
}).refine(data => {
  if (data.type === 'scheduled') {
    return scheduledConfigSchema.safeParse(data.configuration_json).success;
  }
  if (data.type === 'webhook') {
    return webhookConfigSchema.safeParse(data.configuration_json).success;
  }
  if (data.type === 'event_bus') {
    // Add validation for event_bus config if defined, for now, it's open z.record(z.any())
    return true;
  }
  return false;
}, { message: "Configuration JSON does not match trigger type." });

export type TriggerInput = z.infer<typeof triggerInputSchema>;

// Full WorkflowTrigger type (matches DB table)
export const workflowTriggerSchema = triggerInputSchema.extend({
  trigger_id: z.string().uuid(),
  last_triggered_at: z.string().datetime({ offset: true }).optional().nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;


export const createTrigger = async (data: TriggerInput): Promise<WorkflowTrigger> => {
  // Validate workflow_id exists and is active (optional, but good practice)
  const workflow = await getWorkflowDefinitionById(data.workflow_id);
  if (!workflow || !workflow.is_active) {
    throw new Error(`Active workflow with ID ${data.workflow_id} not found.`);
  }

  // For webhook, ensure path_identifier is unique if type is webhook
  if (data.type === 'webhook') {
    const config = data.configuration_json as z.infer<typeof webhookConfigSchema>; // Already validated by refine
    const existing = await query(
      "SELECT trigger_id FROM workflow_triggers WHERE type = 'webhook' AND configuration_json->>'path_identifier' = $1",
      [config.path_identifier]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Webhook trigger with path_identifier '${config.path_identifier}' already exists.`);
    }
  }

  const { name, description, workflow_id, type, configuration_json, is_enabled, created_by_user_id } = data;
  const result = await query(
    `INSERT INTO workflow_triggers (name, description, workflow_id, type, configuration_json, is_enabled, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, description || null, workflow_id, type, configuration_json, is_enabled, created_by_user_id]
  );
  return workflowTriggerSchema.parse(result.rows[0]);
};

export const getTriggerById = async (triggerId: string): Promise<WorkflowTrigger | null> => {
  const result = await query('SELECT * FROM workflow_triggers WHERE trigger_id = $1', [triggerId]);
  if (result.rows.length === 0) return null;
  return workflowTriggerSchema.parse(result.rows[0]);
};

export const getTriggersByWorkflowId = async (workflowId: string): Promise<WorkflowTrigger[]> => {
  const result = await query('SELECT * FROM workflow_triggers WHERE workflow_id = $1 ORDER BY created_at DESC', [workflowId]);
  return z.array(workflowTriggerSchema).parse(result.rows);
};

export const getAllEnabledTriggersByType = async (type: 'scheduled' | 'webhook' | 'event_bus'): Promise<WorkflowTrigger[]> => {
  const result = await query('SELECT * FROM workflow_triggers WHERE type = $1 AND is_enabled = true ORDER BY name ASC', [type]);
  return z.array(workflowTriggerSchema).parse(result.rows);
};


export const updateTrigger = async (triggerId: string, data: Partial<Omit<TriggerInput, 'created_by_user_id'>>): Promise<WorkflowTrigger | null> => {
  const currentTrigger = await getTriggerById(triggerId);
  if (!currentTrigger) return null;

  // Merge and validate new data
  const mergedData = {
    ...currentTrigger,
    ...data,
    // Ensure configuration_json is properly overlaid if present in data
    configuration_json: data.configuration_json !== undefined ? data.configuration_json : currentTrigger.configuration_json,
   };
  // We need to ensure configuration_json is re-validated if type or config itself changes
  // created_by_user_id should not be updatable through this general update method.
  const validatedData = triggerInputSchema.omit({ created_by_user_id: true }).parse(mergedData);


  // If type is webhook and path_identifier is being changed, check uniqueness
  if (validatedData.type === 'webhook' && validatedData.configuration_json) {
    const newConfig = validatedData.configuration_json as WebhookConfig; // Already validated by refine to be WebhookConfig
    const oldConfig = currentTrigger.configuration_json as WebhookConfig; // Assume current is also valid
    if (newConfig.path_identifier !== oldConfig.path_identifier) {
      const existing = await query(
        "SELECT trigger_id FROM workflow_triggers WHERE type = 'webhook' AND configuration_json->>'path_identifier' = $1 AND trigger_id != $2",
        [newConfig.path_identifier, triggerId]
      );
      if (existing.rows.length > 0) {
        throw new Error(`Webhook trigger with path_identifier '${newConfig.path_identifier}' already exists.`);
      }
    }
  }

  const { name, description, workflow_id, type, configuration_json, is_enabled } = validatedData;

  const result = await query(
    `UPDATE workflow_triggers
     SET name = $1, description = $2, workflow_id = $3, type = $4, configuration_json = $5, is_enabled = $6, updated_at = NOW()
     WHERE trigger_id = $7 RETURNING *`,
    [name, description || null, workflow_id, type, configuration_json, is_enabled, triggerId]
  );
  if (result.rows.length === 0) return null;
  return workflowTriggerSchema.parse(result.rows[0]);
};

export const deleteTrigger = async (triggerId: string): Promise<boolean> => {
  const result = await query('DELETE FROM workflow_triggers WHERE trigger_id = $1', [triggerId]);
  return result.rowCount > 0;
};

export const updateLastTriggeredAt = async (triggerId: string): Promise<void> => {
    await query('UPDATE workflow_triggers SET last_triggered_at = NOW() WHERE trigger_id = $1', [triggerId]);
};

import cron from 'node-cron';
import { createWorkflowRun } from './workflowRunService'; // For triggering workflows

// Store active cron jobs to prevent duplicates or to manage them (e.g., stop/restart)
const activeCronJobs: Map<string, cron.ScheduledTask> = new Map();

export const initializeSchedulers = async () => {
  console.log("Initializing workflow schedulers...");
  try {
    const scheduledTriggers = await getAllEnabledTriggersByType('scheduled');

    for (const trigger of scheduledTriggers) {
      if (activeCronJobs.has(trigger.trigger_id)) {
        // Potentially stop and restart if config changed, for now, skip if already active
        console.log(`Scheduler for trigger ${trigger.trigger_id} (${trigger.name}) is already active.`);
        continue;
      }

      const config = trigger.configuration_json as ScheduledConfig; // Assumes validation during creation/update
      if (!cron.validate(config.cron_string)) {
        console.error(`Invalid cron string for trigger ${trigger.trigger_id} (${trigger.name}): ${config.cron_string}`);
        continue;
      }

      const job = cron.schedule(config.cron_string, async () => {
        console.log(`Executing scheduled trigger: ${trigger.trigger_id} - ${trigger.name}`);
        try {
          // Ensure the workflow definition is still active before running
          const workflowDef = await getWorkflowDefinitionById(trigger.workflow_id);
          if (!workflowDef || !workflowDef.is_active) {
            console.warn(`Scheduled trigger ${trigger.trigger_id} references an inactive or non-existent workflow ${trigger.workflow_id}. Skipping run.`);
            // Optionally disable the trigger here:
            // await updateTrigger(trigger.trigger_id, { is_enabled: false });
            return;
          }

          await createWorkflowRun(trigger.workflow_id, null, config.default_payload || {});
          await updateLastTriggeredAt(trigger.trigger_id);
          console.log(`Workflow run initiated by scheduled trigger: ${trigger.name}`);
        } catch (error) {
          console.error(`Error executing scheduled trigger ${trigger.trigger_id} (${trigger.name}):`, error);
        }
      }, {
        timezone: config.timezone || 'UTC', // Ensure timezone is used if provided
      });

      activeCronJobs.set(trigger.trigger_id, job);
      job.start(); // Start the job
      console.log(`Scheduled trigger ${trigger.trigger_id} (${trigger.name}) with cron "${config.cron_string}" in timezone "${config.timezone || 'UTC'}"`);
    }
  } catch (error) {
    console.error("Failed to initialize schedulers:", error);
  }
};

// TODO: Add function to stop/reload schedulers if triggers are updated/deleted, e.g., stopScheduler(triggerId)

export const handleWebhookTrigger = async (pathIdentifier: string, requestPayload: any, requestInfo: { method: string, headers: any }): Promise<any> => {
    console.log(`Handling webhook for path: ${pathIdentifier} (Not yet fully implemented)`);
    // Find trigger by pathIdentifier
    // Validate request (method, security)
    // Transform payload using JQ if configured
    // Call workflowRunService.createWorkflowRun
    // Update last_triggered_at
    // Return response
    // This function is now more fully implemented above.
    // Ensure getNestedValue is available or defined if used for simple payload mapping.
    // For now, direct payload is used if mapping is complex.
    throw new Error("handleWebhookTrigger was called with placeholder, but actual implementation is above. This line should not be reached.");
};
