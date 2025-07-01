import { query } from '../config/db';
import { z } from 'zod';

// Zod schema for Task creation (subset of fields, others are system-set)
export const taskInputSchema = z.object({
  // run_id, step_name_in_workflow, type are typically set by the workflow engine
  assigned_to_agent_id: z.string().uuid().optional().nullable(),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'failed', 'skipped', 'requires_escalation']).optional().default('pending'),
  input_data_json: z.record(z.any()).optional(),
  output_data_json: z.record(z.any()).optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(), // ISO 8601 format
});
export type TaskInput = z.infer<typeof taskInputSchema>;

// For internal creation by workflow engine
export interface TaskCreationData {
  run_id: string;
  step_name_in_workflow: string;
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision' | 'sub_workflow'; // Added sub_workflow
  assigned_to_agent_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_role?: string | null;
  input_data_json?: Record<string, any> | null;
  due_date?: string | null;
  // sub_workflow_run_id is set after creation via an update if type is 'sub_workflow'
}

export const createTask = async (data: TaskCreationData) => {
  const {
    run_id,
    step_name_in_workflow,
    type,
    assigned_to_agent_id,
    assigned_to_user_id,
    assigned_to_role, // Added
    input_data_json,
    due_date
  } = data;

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
    `INSERT INTO tasks (run_id, step_name_in_workflow, type, assigned_to_agent_id, assigned_to_user_id, assigned_to_role, input_data_json, due_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      run_id,
      step_name_in_workflow,
      type,
      assigned_to_agent_id,
      assigned_to_user_id,
      assigned_to_role, // Added
      input_data_json || {},
      due_date,
      initialStatus
    ]
  );
  return result.rows[0];
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
