-- Ensure uuid-ossp extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Generic function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Users Table (Kept from original, roles might be adapted later)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'bank_user' CHECK (role IN ('bank_user', 'bank_admin', 'platform_admin')), -- Example roles
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);


-- Agent Templates Table
CREATE TABLE agent_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    core_logic_identifier VARCHAR(255) NOT NULL, -- e.g., a service name or function identifier
    configurable_params_json_schema JSONB, -- JSON Schema defining configurable parameters
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_agent_templates_updated_at
BEFORE UPDATE ON agent_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_agent_templates_name ON agent_templates(name);


-- Configured Agents Table (Instances of Agent Templates)
CREATE TABLE configured_agents (
    agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES agent_templates(template_id),
    -- bank_id UUID, -- If multi-tenant per bank, add later. For now, assume single tenant or bank context via user.
    user_id UUID REFERENCES users(user_id), -- The user/admin who configured this agent instance
    bank_specific_name VARCHAR(255) NOT NULL,
    configuration_json JSONB, -- Actual configuration values provided by the bank, validated against template's schema
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_configured_agents_updated_at
BEFORE UPDATE ON configured_agents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_configured_agents_template_id ON configured_agents(template_id);
CREATE INDEX idx_configured_agents_user_id ON configured_agents(user_id);
CREATE INDEX idx_configured_agents_status ON configured_agents(status);


-- Workflows Table
CREATE TABLE workflows (
    workflow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    definition_json JSONB NOT NULL, -- JSON defining workflow steps, transitions, agent calls, human tasks
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name, version) -- Ensure name and version combination is unique
);

CREATE TRIGGER update_workflows_updated_at
BEFORE UPDATE ON workflows
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_workflows_name_version ON workflows(name, version);
CREATE INDEX idx_workflows_is_active ON workflows(is_active);


-- Workflow Runs Table (Instances of Workflow Execution)
CREATE TABLE workflow_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(workflow_id),
    triggering_user_id UUID REFERENCES users(user_id), -- User who initiated the run, if applicable
    triggering_data_json JSONB, -- Initial data that started the workflow
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'in_progress', 'completed', 'failed', 'cancelled')),
    current_step_name VARCHAR(255), -- Can be a simple name for non-parallel, or qualified (parallel.branch.step) for parallel
    context_json JSONB, -- Enhanced: stores complete workflow context, variables, and execution state
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    results_json JSONB, -- Stores accumulated outputs from steps
    active_parallel_branches JSONB, -- Stores state of active parallel branches: { "parallelStepName": { "branchName": { status, output } } }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_workflow_runs_updated_at
BEFORE UPDATE ON workflow_runs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_current_step_name ON workflow_runs(current_step_name);
CREATE INDEX idx_workflow_runs_triggering_user_id ON workflow_runs(triggering_user_id);


-- Tasks Table (Individual steps within a workflow run, for agents or humans)
CREATE TABLE tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES workflow_runs(run_id) ON DELETE CASCADE,
    step_name_in_workflow VARCHAR(255) NOT NULL, -- Identifier for the step in the workflow definition
    type VARCHAR(50) NOT NULL CHECK (type IN ('agent_execution', 'human_review', 'data_input', 'decision')),
    assigned_to_agent_id UUID REFERENCES configured_agents(agent_id), -- If type is 'agent_execution'
    assigned_to_user_id UUID REFERENCES users(user_id), -- If type is 'human_review' or other human tasks (direct assignment)
    assigned_to_role VARCHAR(50), -- For role-based assignment of human tasks (e.g., 'loan_officer')
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'skipped', 'requires_escalation')),
    input_data_json JSONB, -- Data required for the task
    output_data_json JSONB, -- Result of the task
    due_date TIMESTAMP WITH TIME ZONE,
    sub_workflow_run_id UUID NULL REFERENCES workflow_runs(run_id), -- For tasks of type 'sub_workflow'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_task_assignment CHECK (
        (type = 'agent_execution' AND assigned_to_agent_id IS NOT NULL AND assigned_to_user_id IS NULL AND assigned_to_role IS NULL) OR
        (type = 'sub_workflow') OR -- Sub-workflow tasks are not directly assigned to users/agents in the parent
        (type NOT IN ('agent_execution', 'sub_workflow') AND assigned_to_agent_id IS NULL AND (assigned_to_user_id IS NOT NULL OR assigned_to_role IS NOT NULL)) OR
        (type NOT IN ('agent_execution', 'sub_workflow') AND assigned_to_agent_id IS NULL AND assigned_to_user_id IS NULL AND assigned_to_role IS NULL) -- e.g. pending assignment
    )
);

CREATE INDEX idx_tasks_sub_workflow_run_id ON tasks(sub_workflow_run_id);

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_tasks_run_id ON tasks(run_id);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to_agent_id ON tasks(assigned_to_agent_id);
CREATE INDEX idx_tasks_assigned_to_user_id ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_assigned_to_role ON tasks(assigned_to_role);


-- Task Comments Table
CREATE TABLE task_comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id), -- User who made the comment
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- In case comments are editable
);

CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON task_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_user_id ON task_comments(user_id);


-- Note: The chk_task_assignment constraint might need refinement based on exact assignment logic.
-- For example, a human task might initially be unassigned or assigned to a group/role.
-- The current constraint is a basic example.
-- Consider adding a 'priority' field to tasks as well.
-- Consider adding a 'context_json' to workflow_runs to store data accumulated through the workflow.

-- (Optional) Table for storing bank-specific configurations if not solely in configured_agents.
-- CREATE TABLE bank_configurations (
--     bank_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Or use a unique bank identifier string
--     bank_name VARCHAR(255) NOT NULL,
--     -- other global bank settings
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- If using this, configured_agents might have a bank_id FOREIGN KEY.
-- For now, user's bank context or a single-tenant assumption is simpler.
-- The `bankConfig` in `backend/src/config/index.ts` handles global settings for this instance.
