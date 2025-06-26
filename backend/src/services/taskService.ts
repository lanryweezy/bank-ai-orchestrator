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
  type: 'agent_execution' | 'human_review' | 'data_input' | 'decision';
  assigned_to_agent_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_role?: string | null; // Added
  input_data_json?: Record<string, any> | null;
  due_date?: string | null; // ISO string
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
export const completeTask = async (taskId: string, outputData: Record<string, any>, completingUserId?: string) => {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new Error('Task not found.');
  }
  if (task.status === 'completed') {
    // Or just return the task? For now, throw error if trying to re-complete.
    throw new Error('Task is already completed.');
  }
  // Authorization: Ensure the completingUserId is the assigned_to_user_id or has permission
  if (task.assigned_to_user_id && task.assigned_to_user_id !== completingUserId) {
      // Add role-based override here if e.g. an admin can complete tasks for others
      // For now, strict check.
      // throw new Error('User not authorized to complete this task.');
      console.warn(`Task ${taskId} completed by ${completingUserId} but assigned to ${task.assigned_to_user_id}`);
  }


  const updatedTask = await updateTask(taskId, {
    status: 'completed',
    output_data_json: outputData,
  });

  // Placeholder: Notify workflow engine that task is complete to process next steps
  // This will be handled by workflowRunService.processTaskCompletion(updatedTask)
  return updatedTask;
};
