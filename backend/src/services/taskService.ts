import { query } from '../config/db';
import { z } from 'zod';

// Zod schema for Task creation (subset of fields, others are system-set)
export const taskInputSchema = z.object({
  assigned_to_agent_id: z.string().uuid().optional().nullable(),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  assigned_to_role: z.string().optional().nullable(), // Added
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'failed', 'skipped', 'requires_escalation']).optional(), // Default removed for updates
  input_data_json: z.record(z.any()).optional(),
  output_data_json: z.record(z.any()).optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(), // ISO 8601 format
  // Fields from DB that might be updated or part of Task object:
  deadline_at: z.string().datetime({ offset: true }).optional().nullable(),
  escalation_policy_json: z.record(z.any()).optional().nullable(), // Using record(z.any()) for now for JSONB
  is_delegated: z.boolean().optional(),
  delegated_by_user_id: z.string().uuid().optional().nullable(),
  retry_count: z.number().int().optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

// Import for escalation policy type (now defined locally as we simplified the workflow service)
interface HumanTaskEscalationPolicy {
  after_minutes: number;
  action: 'reassign_to_role' | 'notify_manager_role' | 'custom_event';
  target_role?: string;
  custom_event_name?: string;
}

// For internal creation by workflow engine
export interface TaskCreationData {
  run_id: string;
  step_name_in_workflow: string;
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision' | 'sub_workflow';
  assigned_to_agent_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_role?: string | null;
  input_data_json?: Record<string, any> | null;
  due_date?: string | null; // This was the original generic due_date, can be used or superseded by deadline_minutes
  deadline_minutes?: number | null; // For calculating deadline_at
  escalation_policy?: HumanTaskEscalationPolicy | null; // From workflow definition
}

export const createTask = async (data: TaskCreationData) => {
  const {
    run_id,
    step_name_in_workflow,
    type,
    assigned_to_agent_id,
    assigned_to_user_id,
    assigned_to_role,
    input_data_json,
    // due_date, // Original due_date field, can be kept or removed if deadline_minutes replaces its use case
    deadline_minutes,
    escalation_policy,
  } = data;

  let deadlineAt: string | null = null;
  if (deadline_minutes && deadline_minutes > 0 && (data.type === 'human_review' || data.type === 'data_input' || data.type === 'decision')) {
    deadlineAt = new Date(Date.now() + deadline_minutes * 60000).toISOString();
  } else if (data.due_date) { // Fallback to use due_date if provided and deadline_minutes isn't
    deadlineAt = data.due_date;
  }

  const escalationPolicyJson = escalation_policy && (data.type === 'human_review' || data.type === 'data_input' || data.type === 'decision')
    ? escalation_policy
    : null;

  // Validation for assignment based on type
  if (type === 'agent_execution' && !assigned_to_agent_id) {
    throw new Error('Agent task must have assigned_to_agent_id.');
  }
  if (type === 'agent_execution' && (assigned_to_user_id || assigned_to_role)) {
    throw new Error('Agent task cannot be assigned to a user or role.');
  }
  if (type !== 'agent_execution' && assigned_to_agent_id) {
    throw new Error('Non-agent task cannot be assigned to an agent.');
  }
  // A human task can be unassigned, or assigned to a user, or assigned to a role, but not both user and role.
  if (type !== 'agent_execution' && assigned_to_user_id && assigned_to_role) {
    throw new Error('Human task cannot be assigned to both a specific user and a role simultaneously.');
  }

  const initialStatus = (assigned_to_agent_id || assigned_to_user_id || assigned_to_role) ? 'assigned' : 'pending';

  const result = await query(
    `INSERT INTO tasks (
        run_id, step_name_in_workflow, type,
        assigned_to_agent_id, assigned_to_user_id, assigned_to_role,
        input_data_json, status,
        deadline_at, escalation_policy_json
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      run_id,
      step_name_in_workflow,
      type,
      assigned_to_agent_id,
      assigned_to_user_id,
      assigned_to_role,
      input_data_json || {},
      initialStatus,
      deadlineAt, // Use calculated deadlineAt
      escalationPolicyJson // Use prepared escalationPolicyJson
    ]
  );
  const newTask = result.rows[0];

  // --- Notification Logic ---
  // Only send notification if it's a human task directly assigned to a user
  if (newTask && newTask.assigned_to_user_id &&
      (newTask.type === 'human_review' || newTask.type === 'data_input' || newTask.type === 'decision')) {

    // Dynamically import to avoid circular dependency if notificationService imports taskService
    const notificationService = await import('./notificationService');

    // Get workflow name for a more descriptive message
    let workflowName = 'a workflow';
    try {
        const runDetails = await query('SELECT w.name FROM workflow_runs wr JOIN workflows w ON wr.workflow_id = w.workflow_id WHERE wr.run_id = $1', [newTask.run_id]);
        if (runDetails.rows.length > 0) {
            workflowName = `workflow "${runDetails.rows[0].name}"`;
        }
    } catch (e) { console.error("Error fetching workflow name for notification:", e); }

    await notificationService.createNotification({
      user_id: newTask.assigned_to_user_id,
      type: 'task_assigned',
      message: `You have been assigned a new task: "${newTask.step_name_in_workflow}" in ${workflowName}.`,
      related_entity_type: 'task',
      related_entity_id: newTask.task_id
    }).catch(err => {
      // Log error but don't let notification failure stop task creation
      console.error(`Failed to create task assignment notification for task ${newTask.task_id} to user ${newTask.assigned_to_user_id}:`, err);
    });
  }
  // TODO: Consider notifications for role-based assignments. This would involve:
  // 1. Querying all users with the assigned_to_role.
  // 2. Creating notifications for each of them.
  // This could be a significant number of notifications, so might need batching or a different strategy.
  // For now, only direct user assignments trigger notifications.

  return newTask;
};

export const getTaskById = async (taskId: string) => {
  const result = await query('SELECT * FROM tasks WHERE task_id = $1', [taskId]);
  return result.rows[0] || null;
};

// Get tasks for a specific user (either directly assigned or assigned to their role)
export const getTasksForUser = async (userId: string, userRole: string, status?: string) => {
  let queryString = `
    SELECT t.*, wr.workflow_id, w.name as workflow_name
    FROM tasks t
    JOIN workflow_runs wr ON t.run_id = wr.run_id
    JOIN workflows w ON wr.workflow_id = w.workflow_id
    WHERE (t.assigned_to_user_id = $1 OR t.assigned_to_role = $2)
  `;
  const queryParams: any[] = [userId, userRole];
  let paramIndex = 3;

  if (status) {
    queryString += ` AND t.status = $${paramIndex++}`;
    queryParams.push(status);
  }
  // Exclude tasks that are purely for agents if not explicitly fetched by agent ID
  queryString += ` AND t.type != 'agent_execution'`;
  queryString += ' ORDER BY t.created_at DESC';

  const result = await query(queryString, queryParams);
  return result.rows;
};

// Get tasks for a specific agent (less common for agent to query this itself)
export const getTasksForAgent = async (agentId: string, status?: string) => {
  let queryString = 'SELECT * FROM tasks WHERE assigned_to_agent_id = $1';
    const queryParams: any[] = [agentId];
  if (status) {
    queryString += ' AND status = $2';
    queryParams.push(status);
  }
  queryString += ' ORDER BY created_at DESC';
  const result = await query(queryString, queryParams);
  return result.rows;
};

export const getTasksForRun = async (runId: string) => {
    const result = await query('SELECT * FROM tasks WHERE run_id = $1 ORDER BY created_at ASC', [runId]);
    return result.rows;
};

// Simplified Escalation Check (not called automatically by a scheduler in this iteration)
export const checkAndProcessTaskEscalation = async (taskId: string) => {
    const task = await getTaskById(taskId);
    if (!task || task.type === 'agent_execution' || task.type === 'sub_workflow') {
        // console.log(`Task ${taskId} not found or not a human task, skipping escalation check.`);
        return null;
    }

    if (['completed', 'failed', 'skipped', 'requires_escalation'].includes(task.status)) {
        // console.log(`Task ${taskId} is in a terminal or already escalated status (${task.status}), skipping escalation check.`);
        return null;
    }

    if (task.deadline_at && task.escalation_policy_json) {
        const deadline = new Date(task.deadline_at);
        if (new Date() > deadline) {
            console.log(`Task ${taskId} is overdue. Processing escalation policy.`);
            const policy = task.escalation_policy_json as HumanTaskEscalationPolicy; // Cast from JSONB
            let updatePayload: Partial<TaskInput> = { status: 'requires_escalation' }; // Default escalation status

            switch (policy.action) {
                case 'reassign_to_role':
                    if (policy.target_role) {
                        console.log(`Task ${taskId} escalated: Reassigning to role ${policy.target_role}.`);
                        updatePayload.assigned_to_role = policy.target_role;
                        updatePayload.assigned_to_user_id = null; // Clear direct user assignment
                        updatePayload.is_delegated = false; // Clear delegation fields
                        updatePayload.delegated_by_user_id = null;
                    } else {
                        console.warn(`Task ${taskId} escalation: 'reassign_to_role' action missing target_role.`);
                    }
                    break;
                case 'notify_manager_role':
                    if (policy.target_role) {
                        console.log(`Task ${taskId} escalated: Emitting notification for manager role ${policy.target_role}. (Notification not implemented)`);
                        // Actual notification logic would go here or be triggered by an event.
                    } else {
                        console.warn(`Task ${taskId} escalation: 'notify_manager_role' action missing target_role.`);
                    }
                    break;
                case 'custom_event':
                    if (policy.custom_event_name) {
                        console.log(`Task ${taskId} escalated: Emitting custom event '${policy.custom_event_name}'. (Event emission not implemented)`);
                        // Actual event emission logic here.
                    } else {
                        console.warn(`Task ${taskId} escalation: 'custom_event' action missing custom_event_name.`);
                    }
                    break;
                default:
                    console.warn(`Task ${taskId} escalation: Unknown action '${(policy as any).action}'.`);
            }

            // To prevent re-escalating immediately on next check if status alone doesn't stop it:
            // Option 1: Clear deadline_at or escalation_policy_json (but this loses info)
            // Option 2: Add an 'escalated_at' timestamp and check against it.
            // Option 3: Rely on status 'requires_escalation' to be handled by an admin/manager.
            // For now, setting status to 'requires_escalation' is the primary mechanism.
            // updatePayload.escalation_processed_at = new Date().toISOString(); // Example if adding such a field

            return updateTask(taskId, updatePayload);
        } else {
            // console.log(`Task ${taskId} is not yet overdue. Deadline: ${task.deadline_at}`);
        }
    }
    return null; // No escalation occurred
};

export const delegateTask = async (taskId: string, delegatingUserId: string, targetUserId: string) => {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  if (task.type === 'agent_execution' || task.type === 'sub_workflow') {
    throw new Error(`Task ${taskId} is of type ${task.type} and cannot be delegated by a user.`);
  }
  if (task.assigned_to_user_id !== delegatingUserId) {
    throw new Error(`User ${delegatingUserId} is not the current assignee of task ${taskId} and cannot delegate it.`);
  }
  if (delegatingUserId === targetUserId) {
    throw new Error('Cannot delegate task to the same user.');
  }

  // TODO: Check if targetUserId is a valid user in the system (optional, depends on how strict)

  const updatedFields: Partial<TaskInput> = { // Explicitly type to help inference
    assigned_to_user_id: targetUserId,
    delegated_by_user_id: delegatingUserId,
    is_delegated: true,
    status: 'assigned' as const, // Reset status for the new assignee, use 'as const'
    assigned_to_role: null, // Clear role assignment if any when delegating to a specific user
  };

  // Add a comment about the delegation
  try {
    const delegatingUser = await query('SELECT username FROM users WHERE user_id = $1', [delegatingUserId]);
    const targetUser = await query('SELECT username FROM users WHERE user_id = $1', [targetUserId]);
    const commentText = `Task delegated from ${delegatingUser.rows[0]?.username || 'Previous User'} to ${targetUser.rows[0]?.username || 'New User'}.`;
    await createTaskComment(taskId, delegatingUserId, commentText); // System comment or delegating user's comment
  } catch (commentError) {
    console.error("Failed to create delegation comment:", commentError);
    // Proceed with delegation even if comment fails
  }

  return updateTask(taskId, updatedFields);
};

export const updateTask = async (taskId: string, data: Partial<TaskInput>) => {
  const fields = Object.keys(data) as (keyof Partial<TaskInput>)[];
  const values = Object.values(data);

  if (fields.length === 0) {
    return getTaskById(taskId);
  }

  const setClauses = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');
  const queryString = `UPDATE tasks SET ${setClauses} WHERE task_id = $1 RETURNING *`;

  const result = await query(queryString, [taskId, ...values]);
  return result.rows[0] || null;
};

// This is a critical function, as completing a task often triggers workflow progression.
export const completeTask = async (
    taskId: string,
    outputData: Record<string, any>,
    completingUserId?: string | null,
    finalStatus: 'completed' | 'failed' = 'completed' // Allow specifying 'failed' for system updates like sub-workflow
) => {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  // Allow re-completion if status is 'failed' and we are trying to mark it 'failed' again (idempotency for system)
  // Or if trying to mark a non-terminal task as 'failed' by system
  if (task.status === 'completed' && finalStatus === 'completed') {
     console.warn(`Task ${taskId} is already completed. Returning current state.`);
     return task;
    // For human actions, might throw: throw new Error('Task is already completed.');
  }
  if (task.status === 'failed' && finalStatus === 'failed') {
    console.warn(`Task ${taskId} is already failed. Returning current state.`);
    return task;
  }

  // Authorization for human completion
  if (completingUserId && task.assigned_to_user_id && task.assigned_to_user_id !== completingUserId) {
      // TODO: Add role-based override for admins/managers if needed
      console.warn(`User ${completingUserId} attempting to complete task ${taskId} assigned to ${task.assigned_to_user_id}.`);
      // For now, we allow this but log it. Stricter systems might throw an error.
      // throw new Error('User not authorized to complete this task.');
  }

  const updatedTask = await updateTask(taskId, {
    status: finalStatus,
    output_data_json: outputData,
  });

  // Placeholder: Notify workflow engine that task is complete to process next steps
  // This will be handled by workflowRunService.processTaskCompletionAndContinueWorkflow
  return updatedTask;
};


// --- Task Comments ---
export const taskCommentSchema = z.object({
    comment_text: z.string().min(1, "Comment text cannot be empty."),
});
export type TaskCommentInput = z.infer<typeof taskCommentSchema>;

export const createTaskComment = async (taskId: string, userId: string, commentText: string) => {
    const result = await query(
        'INSERT INTO task_comments (task_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING *',
        [taskId, userId, commentText]
    );
    // Join with user details for immediate display
    const comment = result.rows[0];
    const userResult = await query('SELECT username, full_name FROM users WHERE user_id = $1', [comment.user_id]);
    return {
        ...comment,
        user: userResult.rows[0] || { username: 'Unknown User' }
    };
};

export const getTaskComments = async (taskId: string) => {
    const result = await query(
        `SELECT tc.*, u.username, u.full_name
         FROM task_comments tc
         JOIN users u ON tc.user_id = u.user_id
         WHERE tc.task_id = $1
         ORDER BY tc.created_at ASC`,
        [taskId]
    );
    return result.rows;
};

export const getTaskSummaryForUser = async (userId: string, userRole: string, limit: number = 5) => {
    // Get counts by status
    const statusCountsQuery = `
        SELECT status, COUNT(*) as count
        FROM tasks
        WHERE (assigned_to_user_id = $1 OR assigned_to_role = $2)
          AND type != 'agent_execution' AND type != 'sub_workflow'
          AND status IN ('pending', 'assigned', 'in_progress')
        GROUP BY status;
    `;
    const statusCountsResult = await query(statusCountsQuery, [userId, userRole]);
    const counts = statusCountsResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count, 10);
        return acc;
    }, {});

    // Get recent (or high-priority if priority field existed) tasks that are not completed/failed
    const recentTasksQuery = `
        SELECT t.task_id, t.step_name_in_workflow, t.status, t.due_date, t.created_at, w.name as workflow_name
        FROM tasks t
        JOIN workflow_runs wr ON t.run_id = wr.run_id
        JOIN workflows w ON wr.workflow_id = w.workflow_id
        WHERE (t.assigned_to_user_id = $1 OR t.assigned_to_role = $2)
          AND t.type != 'agent_execution' AND t.type != 'sub_workflow'
          AND t.status NOT IN ('completed', 'failed', 'skipped')
        ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
        LIMIT $3;
    `;
    // Prioritize by due date soonest, then by most recently created
    const recentTasksResult = await query(recentTasksQuery, [userId, userRole, limit]);

    return {
        counts: {
            pending: counts.pending || 0,
            assigned: counts.assigned || 0,
            in_progress: counts.in_progress || 0,
        },
        recent_tasks: recentTasksResult.rows
    };
};
