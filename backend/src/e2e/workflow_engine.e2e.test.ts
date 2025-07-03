import request from 'supertest';
import app from '../server'; // Assuming server.ts exports the app instance
import { Pool } from 'pg';
import { serverConfig, dbConfig } from '../config'; // For direct DB checks if needed & server port

// Helper to get an admin token (placeholder - needs actual implementation or mock)
// For real E2E, this would involve logging in a test admin user.
// For now, we might need to bypass auth in a test-specific app setup or use a known static token if dev only.
const getAdminToken = async (): Promise<string> => {
    // Placeholder: In a real E2E setup, you'd log in a test admin user.
    // For this example, let's assume there's a way to get a token or tests run with auth disabled.
    // This might involve directly generating a token for a known test admin user.
    // This is a CRITICAL part for real E2E tests.
    // For now, if your admin routes are protected, these tests will fail without a valid token.
    // A common pattern is to have a separate test setup that seeds a user and logs them in.
    // Or, for non-user-centric E2E, sometimes auth is disabled for the test environment's app instance.

    // Simple placeholder for a JWT token - REPLACE WITH ACTUAL VALID TOKEN OR MECHANISM
    // This token will likely be invalid.
    const testAdminUser = { userId: 'test-admin-user-id', role: 'platform_admin', username: 'e2e_admin' };
    // const token = jwt.sign(testAdminUser, serverConfig.jwtSecret, { expiresIn: '1h' });
    // return token;
    // For now, returning a placeholder. Many tests will fail if auth is enforced.
    // If your middleware authMiddleware.ts uses `req.user = decoded;`, then for tests you might
    // have a special test middleware that sets req.user.
    // For API tests, it's best to actually authenticate.
    return "test_admin_token_placeholder";
};


// Database connection for direct checks (use with caution in E2E, prefer API verification)
// const pool = new Pool(dbConfig);

describe('Workflow Engine E2E Tests - API Driven', () => {
    let adminToken: string;
    let createdWorkflowId: string;
    let createdWorkflowName: string;

    // Example workflow definition for testing conditional logic
    const conditionalWorkflowDefinition = {
        name: `E2E Conditional Test ${Date.now()}`, // Unique name
        description: "E2E test for conditional branching.",
        definition_json: {
            start_step: "decision_step",
            steps: [
                {
                    name: "decision_step",
                    type: "decision" as const,
                    description: "Decides path based on input 'action'",
                    transitions: [
                        {
                            to: "path_a_step",
                            condition_type: "conditional" as const,
                            condition_group: {
                                logical_operator: "AND" as const,
                                conditions: [
                                    { field: "context.action", operator: "==" as const, value: "approve" }
                                ]
                            }
                        },
                        {
                            to: "path_b_step",
                            condition_type: "conditional" as const,
                            condition_group: {
                                logical_operator: "AND" as const,
                                conditions: [
                                    { field: "context.action", operator: "==" as const, value: "reject" }
                                ]
                            }
                        },
                        { to: "end_fallback", condition_type: "always" as const }
                    ]
                },
                { name: "path_a_step", type: "human_review" as const, assigned_role: "tester", output_namespace: "path_a_output", transitions: [{ to: "end_path_a", condition_type: "always" as const }] },
                { name: "path_b_step", type: "human_review" as const, assigned_role: "tester", output_namespace: "path_b_output", transitions: [{ to: "end_path_b", condition_type: "always" as const }] },
                { name: "end_path_a", type: "end" as const, final_status: "completed" as const },
                { name: "end_path_b", type: "end" as const, final_status: "completed" as const },
                { name: "end_fallback", type: "end" as const, final_status: "failed" as const }
            ]
        },
        is_active: true
    };

    beforeAll(async () => {
        adminToken = await getAdminToken(); // This needs to be a valid token for admin routes

        // Create the workflow definition using the admin API
        const createWorkflowRes = await request(app)
            .post('/api/admin/workflows')
            .set('Authorization', `Bearer ${adminToken}`) // Assuming Bearer token auth
            .send(conditionalWorkflowDefinition);

        // console.log("Create workflow response:", createWorkflowRes.status, createWorkflowRes.body);
        expect(createWorkflowRes.status).toBe(201);
        expect(createWorkflowRes.body.workflow_id).toBeDefined();
        createdWorkflowId = createWorkflowRes.body.workflow_id;
        createdWorkflowName = conditionalWorkflowDefinition.name;
    });

    afterAll(async () => {
        // Clean up created workflow definition (if needed and if admin delete endpoint exists)
        if (createdWorkflowId) {
            // const deleteRes = await request(app)
            //     .delete(`/api/admin/workflows/${createdWorkflowId}`)
            //     .set('Authorization', `Bearer ${adminToken}`);
            // console.log(`Cleanup delete status: ${deleteRes.status}`);
        }
        // await pool.end();
    });

    const pollWorkflowRunStatus = async (runId: string, targetStatus: string, maxAttempts = 10, delay = 500) => {
        for (let i = 0; i < maxAttempts; i++) {
            const res = await request(app)
                .get(`/api/workflow-runs/${runId}`)
                .set('Authorization', `Bearer ${adminToken}`); // Assuming user token or admin token can access

            if (res.body.status === targetStatus) {
                return res.body;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        throw new Error(`Workflow run ${runId} did not reach status ${targetStatus} within ${maxAttempts * delay}ms`);
    };

    const completeHumanTask = async (runId: string, stepName: string, taskOutput: any, assignedRole = "tester") => {
        // 1. Find the task ID. Need an endpoint to get tasks for a run, or by step name + role.
        // This is a simplification. A real system would have better ways to find active tasks.
        const tasksRes = await request(app)
            .get(`/api/tasks/run/${runId}`) // Assuming such an endpoint exists (it doesn't by default)
                                            // Or /api/tasks?runId=...&role=...&status=assigned
            .set('Authorization', `Bearer ${adminToken}`); // Token of a user in "tester" role or admin

        if (tasksRes.status !== 200 || !tasksRes.body.length) {
            console.error("Tasks for run response:", tasksRes.status, tasksRes.body);
            throw new Error(`Could not find tasks for run ${runId}`);
        }

        const taskToComplete = tasksRes.body.find((t: any) => t.step_name_in_workflow === stepName && t.status === 'assigned');
        if (!taskToComplete) {
            console.error("Relevant task not found or not assigned:", tasksRes.body);
            throw new Error(`Task for step ${stepName} in run ${runId} not found or not in assignable state.`);
        }

        // 2. Complete the task
        const completeRes = await request(app)
            .post(`/api/tasks/${taskToComplete.task_id}/complete`)
            .set('Authorization', `Bearer ${adminToken}`) // Token of user assigned or admin
            .send(taskOutput);
        expect(completeRes.status).toBe(200);
        return completeRes.body;
    };


    test('Scenario 1a: Conditional logic - "approve" path', async () => {
        const startPayload = {
            triggering_data_json: { action: "approve", initialData: "some value for A" }
        };

        const startRes = await request(app)
            .post(`/api/workflows/${createdWorkflowId}/start`)
            .set('Authorization', `Bearer ${adminToken}`) // Assuming a generic user token can start
            .send(startPayload);

        expect(startRes.status).toBe(201);
        const runId = startRes.body.run_id;
        expect(runId).toBeDefined();

        // Workflow should create a human_review task for "path_a_step"
        // Wait for the task to be created (or workflow to progress to it)
        let runState = await pollWorkflowRunStatus(runId, 'in_progress'); // Wait for it to be in_progress
        expect(runState.current_step_name).toBe('path_a_step'); // or the task name if it's a human task that pauses

        // Complete the human task for path_a_step
        await completeHumanTask(runId, "path_a_step", { review_path_a: "approved by tester" });

        runState = await pollWorkflowRunStatus(runId, 'completed');
        expect(runState.status).toBe('completed');
        expect(runState.current_step_name).toBe('end_path_a');
        expect(runState.results_json.path_a_output.review_path_a).toBe("approved by tester");
        expect(runState.results_json.context.action).toBe("approve");
    });

    test('Scenario 1b: Conditional logic - "reject" path', async () => {
        const startPayload = {
            triggering_data_json: { action: "reject", initialData: "some value for B" }
        };

        const startRes = await request(app)
            .post(`/api/workflows/${createdWorkflowId}/start`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(startPayload);

        expect(startRes.status).toBe(201);
        const runId = startRes.body.run_id;

        let runState = await pollWorkflowRunStatus(runId, 'in_progress');
        expect(runState.current_step_name).toBe('path_b_step');

        await completeHumanTask(runId, "path_b_step", { review_path_b: "rejected by tester" });

        runState = await pollWorkflowRunStatus(runId, 'completed');
        expect(runState.status).toBe('completed');
        expect(runState.current_step_name).toBe('end_path_b');
        expect(runState.results_json.path_b_output.review_path_b).toBe("rejected by tester");
        expect(runState.results_json.context.action).toBe("reject");
    });

    test('Scenario 1c: Conditional logic - fallback path', async () => {
        const startPayload = {
            triggering_data_json: { action: "unknown", initialData: "some value for fallback" }
        };

        const startRes = await request(app)
            .post(`/api/workflows/${createdWorkflowId}/start`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(startPayload);

        expect(startRes.status).toBe(201);
        const runId = startRes.body.run_id;

        const runState = await pollWorkflowRunStatus(runId, 'failed'); // Fallback leads to 'failed' status
        expect(runState.status).toBe('failed');
        expect(runState.current_step_name).toBe('end_fallback');
        expect(runState.results_json.context.action).toBe("unknown");
    });

    // TODO: More scenarios:
    // Scenario 2: Parallel Execution & Join
    // Scenario 3: Error Handling (Retry & Fallback)
    // Scenario 4: Scheduled Trigger (might need special handling/mocking for time)
    // Scenario 5: Webhook Trigger & External API Call Step (needs external service mock e.g. with nock)

});
