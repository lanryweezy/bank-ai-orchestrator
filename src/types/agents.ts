// For Agent Monitoring Dashboard
export interface AgentStatusCounts {
    active: number;
    inactive: number;
    error: number;
    total: number;
}

export interface RecentlyActiveAgent {
    agent_id: string;
    bank_specific_name: string;
    template_name: string;
    status: string;
    last_task_activity: string; // ISO date string
}

export interface ErrorStateAgent {
    agent_id: string;
    bank_specific_name: string;
    template_name: string;
    status: 'error'; // Should always be 'error'
    last_config_update: string; // ISO date string
}

export interface AgentMonitoringSummary {
    status_counts: AgentStatusCounts;
    recently_active_agents: RecentlyActiveAgent[];
    error_state_agents: ErrorStateAgent[];
}

// Existing types - ensure they are comprehensive or augment if needed elsewhere
// It seems AgentTemplate is already in @/types/agentTemplates.ts
// And ConfiguredAgent is also likely in @/types/agentTemplates.ts
// We might need to ensure these are consistently used or merged if there's overlap.
// For now, focusing on the new summary types.
