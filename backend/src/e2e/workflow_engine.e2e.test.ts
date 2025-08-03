import request from 'supertest';
import app from '../server';
import nock from 'nock';
// import { Pool } from 'pg';
// import { serverConfig, dbConfig } from '../config';

const getAdminToken = async (): Promise<string> => {
    return "test_admin_token_placeholder";
};

describe('Workflow Engine E2E Tests - API Driven', () => {
    let adminToken: string;
    let createdWorkflowId: string;
    // let createdWorkflowName: string; // Not used by conditional tests directly after creation

    const conditionalWorkflowDefinition = {
        name: `E2E Conditional Test ${Date.now()}`,
        description: "E2E test for conditional branching.",
        definition_json: {
            start_step: "decision_step",
            steps: [
                {
                    name: "decision_step", type: "decision" as const, description: "Decides path based on input 'action'",
                    transitions: [
                        { to: "path_a_step", condition_type: "conditional" as const, condition_group: { logical_operator: "AND" as const, conditions: [ { field: "context.action", operator: "==" as const, value: "approve" } ] } },
                        { to: "path_b_step", condition_type: "conditional" as const, condition_group: { logical_operator: "AND" as const, conditions: [ { field: "context.action", operator: "==" as const, value: "reject" } ] } },
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
        adminToken = await getAdminToken();
        const createWorkflowRes = await request(app)
            .post('/api/admin/workflows')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(conditionalWorkflowDefinition);
        expect(createWorkflowRes.status).toBe(201);
        expect(createWorkflowRes.body.workflow_id).toBeDefined();
        createdWorkflowId = createWorkflowRes.body.workflow_id;
        // createdWorkflowName = conditionalWorkflowDefinition.name; // Not needed by these tests
    });

    afterAll(async () => {
        if (createdWorkflowId) { /* Optional: Call delete endpoint */ }
        nock.cleanAll(); // Ensure nock is cleaned up if used in any test
    });

    const pollWorkflowRunStatus = async (runId: string, targetStatus: string, maxAttempts = 10, delay = 500) => {
        for (let i = 0; i < maxAttempts; i++) {
            const res = await request(app)
                .get(`/api/workflow-runs/${runId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            if (res.body.status === targetStatus) return res.body;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        throw new Error(`Workflow run ${runId} did not reach status ${targetStatus} within ${maxAttempts * delay}ms`);
    };

    const completeHumanTask = async (runId: string, stepName: string, taskOutput: any, _assignedRole = "tester") => {
        const tasksRes = await request(app)
            .get(`/api/admin/workflow-runs/${runId}/tasks`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(tasksRes.status).toBe(200);
        expect(tasksRes.body).toBeInstanceOf(Array);
        const taskToComplete = tasksRes.body.find((t: any) => t.step_name_in_workflow === stepName && (t.status === 'assigned' || t.status === 'pending'));
        if (!taskToComplete) {
            console.error("Tasks found for human task completion:", JSON.stringify(tasksRes.body, null, 2));
            throw new Error(`Task for step '${stepName}' in run '${runId}' not found or not in an actionable state.`);
        }
        const completeRes = await request(app)
            .post(`/api/tasks/${taskToComplete.task_id}/complete`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({output_data_json: taskOutput}); // Ensure output is wrapped correctly
        expect(completeRes.status).toBe(200);
        return completeRes.body;
    };

    test('Scenario 1a: Conditional logic - "approve" path', async () => {
        const startPayload = { triggering_data_json: { action: "approve", initialData: "some value for A" } };
        const startRes = await request(app).post(`/api/workflows/${createdWorkflowId}/start`).set('Authorization', `Bearer ${adminToken}`).send(startPayload);
        expect(startRes.status).toBe(201);
        const runId = startRes.body.run_id;
        expect(runId).toBeDefined();
        let runState = await pollWorkflowRunStatus(runId, 'in_progress');
        expect(runState.current_step_name).toBe('path_a_step');
        await completeHumanTask(runId, "path_a_step", { review_path_a: "approved by tester" });
        runState = await pollWorkflowRunStatus(runId, 'completed');
        expect(runState.status).toBe('completed');
        expect(runState.current_step_name).toBe('end_path_a');
        expect(runState.results_json.path_a_output.review_path_a).toBe("approved by tester");
        expect(runState.results_json.context.action).toBe("approve");
    });

    test('Scenario 1b: Conditional logic - "reject" path', async () => {
        const startPayload = { triggering_data_json: { action: "reject", initialData: "some value for B" } };
        const startRes = await request(app).post(`/api/workflows/${createdWorkflowId}/start`).set('Authorization', `Bearer ${adminToken}`).send(startPayload);
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
        const startPayload = { triggering_data_json: { action: "unknown", initialData: "some value for fallback" } };
        const startRes = await request(app).post(`/api/workflows/${createdWorkflowId}/start`).set('Authorization', `Bearer ${adminToken}`).send(startPayload);
        expect(startRes.status).toBe(201);
        const runId = startRes.body.run_id;
        const runState = await pollWorkflowRunStatus(runId, 'failed');
        expect(runState.status).toBe('failed');
        expect(runState.current_step_name).toBe('end_fallback');
        expect(runState.results_json.context.action).toBe("unknown");
    });

    describe('Scenario 2: Parallel Execution and Join', () => {
        // ... (Scenario 2 implementation from previous successful diff) ...
        let parallelWorkflowId: string;
        const parallelWorkflowName = `E2E Parallel Test ${Date.now()}`;
        const parallelWorkflowDef = {
            name: parallelWorkflowName,
            description: "E2E test for parallel execution and join.",
            definition_json: {
                start_step: "parallel_gate",
                steps: [
                    {
                        name: "parallel_gate", type: "parallel" as const, join_on: "join_gate",
                        branches: [
                            { name: "branch_a", start_step: "human_task_a", steps: [ { name: "human_task_a", type: "human_review" as const, assigned_role: "tester_a", output_namespace: "branch_a_output", transitions: [{to: "join_gate", condition_type: "always" as const}]} ] },
                            { name: "branch_b", start_step: "human_task_b", steps: [ { name: "human_task_b", type: "human_review" as const, assigned_role: "tester_b", output_namespace: "branch_b_output", transitions: [{to: "join_gate", condition_type: "always" as const}]} ] }
                        ]
                    },
                    { name: "join_gate", type: "join" as const, transitions: [{to: "final_step", condition_type: "always" as const}] },
                    { name: "final_step", type: "human_review" as const, assigned_role: "final_reviewer", output_namespace:"final_out", transitions:[{to: "end_parallel", condition_type: "always" as const}]},
                    { name: "end_parallel", type: "end" as const, final_status: "completed" as const }
                ]
            },
            is_active: true
        };
        beforeAll(async () => {
            const createRes = await request(app).post('/api/admin/workflows').set('Authorization', `Bearer ${adminToken}`).send(parallelWorkflowDef);
            expect(createRes.status).toBe(201); parallelWorkflowId = createRes.body.workflow_id;
        });
        test('should execute parallel branches and join correctly', async () => {
            const startRes = await request(app).post(`/api/workflows/${parallelWorkflowId}/start`).set('Authorization', `Bearer ${adminToken}`).send({ triggering_data_json: { testId: "parallel-123" } });
            expect(startRes.status).toBe(201); const runId = startRes.body.run_id;
            await new Promise(resolve => setTimeout(resolve, 1000));
            await completeHumanTask(runId, "human_task_a", { task_a_review: "approved_a" });
            await completeHumanTask(runId, "human_task_b", { task_b_review: "approved_b" });
            await new Promise(resolve => setTimeout(resolve, 500));
            await completeHumanTask(runId, "final_step", { final_review_data: "done_parallel" });
            const finalRunState = await pollWorkflowRunStatus(runId, 'completed', 20, 500);
            expect(finalRunState.status).toBe('completed'); expect(finalRunState.current_step_name).toBe('end_parallel');
            expect(finalRunState.results_json.testId).toBe("parallel-123");
            expect(finalRunState.results_json.branch_a_output.task_a_review).toBe("approved_a");
            expect(finalRunState.results_json.branch_b_output.task_b_review).toBe("approved_b");
            expect(finalRunState.results_json.final_out.final_review_data).toBe("done_parallel");
        }, 20000);
    });

    describe('Scenario 3a: Error Handling - Retry then Fail Workflow', () => {
        // ... (Scenario 3a implementation from previous successful diff) ...
        let errorWorkflowId: string; const errorWorkflowName = `E2E Error RetryFail Test ${Date.now()}`;
        const mockApiHost = 'http://localhost:1234'; const mockApiPath = '/api/alwaysfails';
        const errorWorkflowDef = { name: errorWorkflowName, definition_json: { start_step: "failing_api_call", steps: [ { name: "failing_api_call", type: "external_api_call" as const, external_api_call_config: { url_template: `${mockApiHost}${mockApiPath}`, method: "POST" as const, body_template: { data: "test" }, success_criteria: { status_codes: [200] } }, error_handling: { retry_policy: { max_attempts: 2, delay_seconds: 0 },  on_failure: { action: "fail_workflow" as const, error_output_namespace: "apiError" } }, transitions: [{ to: "should_not_reach", condition_type: "always" as const }] }, { name: "should_not_reach", type: "end" as const, final_status: "completed" as const } ] }, is_active: true };
        let nockScope: import('nock').Scope;
        beforeAll(async () => { nockScope = nock(mockApiHost).persist(); const createRes = await request(app).post('/api/admin/workflows').set('Authorization', `Bearer ${adminToken}`).send(errorWorkflowDef); expect(createRes.status).toBe(201); errorWorkflowId = createRes.body.workflow_id; });
        afterAll(() => { nock.cleanAll(); });
        test('should retry API call and then fail workflow', async () => {
            nockScope.post(mockApiPath).times(2).reply(500, { message: "Internal Server Error" });
            const startRes = await request(app).post(`/api/workflows/${errorWorkflowId}/start`).set('Authorization', `Bearer ${adminToken}`).send({ triggering_data_json: { testId: "error-retry-fail-123" } });
            expect(startRes.status).toBe(201); const runId = startRes.body.run_id;
            const finalRunState = await pollWorkflowRunStatus(runId, 'failed', 20, 500);
            expect(finalRunState.status).toBe('failed'); expect(finalRunState.current_step_name).toBe('failing_api_call');
            expect(finalRunState.results_json.apiError).toBeDefined();
            expect(finalRunState.results_json.apiError.message).toContain("External API call"); // Message now includes template
            expect(finalRunState.results_json.apiError.retry_attempts_made).toBe(1);
            expect(nock.isDone()).toBe(true); // Nock now checks all its defined mocks were hit
            const tasksRes = await request(app).get(`/api/admin/workflow-runs/${runId}/tasks`).set('Authorization', `Bearer ${adminToken}`);
            const apiCallTask = tasksRes.body.find((t:any) => t.step_name_in_workflow === "failing_api_call");
            expect(apiCallTask).toBeDefined(); expect(apiCallTask.retry_count).toBe(1); expect(apiCallTask.status).toBe('failed');
        }, 20000);
    });

    describe('Scenario 3b: Error Handling - Retry then Transition to Fallback', () => {
        // ... (Scenario 3b implementation from previous successful diff) ...
        let fallbackWorkflowId: string; const fallbackWorkflowName = `E2E Error RetryFallback Test ${Date.now()}`;
        const mockApiHostFb = 'http://localhost:1235'; const mockApiPathFb = '/api/alwaysfails_for_fallback';
        const fallbackWorkflowDef = { name: fallbackWorkflowName, definition_json: { start_step: "failing_api_call_fb", steps: [ { name: "failing_api_call_fb", type: "external_api_call" as const, external_api_call_config: { url_template: `${mockApiHostFb}${mockApiPathFb}`, method: "GET" as const, success_criteria: { status_codes: [200] } }, error_handling: { retry_policy: { max_attempts: 2, delay_seconds: 0 }, on_failure: { action: "transition_to_step" as const, next_step: "fallback_human_step", error_output_namespace: "callError" } }, transitions: [{ to: "should_not_reach_fb", condition_type: "always" as const }] }, { name: "fallback_human_step", type: "human_review" as const, assigned_role: "error_handler", output_namespace: "fallback_out", transitions: [{to: "end_fallback_handled", condition_type: "always" as const}] }, { name: "should_not_reach_fb", type: "end" as const, final_status: "completed" as const }, { name: "end_fallback_handled", type: "end" as const, final_status: "completed" as const } ] }, is_active: true };
        let nockScopeFb: import('nock').Scope;
        beforeAll(async () => { nockScopeFb = nock(mockApiHostFb).persist(); const createRes = await request(app).post('/api/admin/workflows').set('Authorization', `Bearer ${adminToken}`).send(fallbackWorkflowDef); expect(createRes.status).toBe(201); fallbackWorkflowId = createRes.body.workflow_id; });
        afterAll(() => { nock.cleanAll(); });
        test('should retry, then transition to fallback step, then allow completion', async () => {
            nockScopeFb.get(mockApiPathFb).times(2).reply(503, { message: "Service Unavailable" });
            const startRes = await request(app).post(`/api/workflows/${fallbackWorkflowId}/start`).set('Authorization', `Bearer ${adminToken}`).send({ triggering_data_json: { testId: "fallback-123" } });
            expect(startRes.status).toBe(201); const runId = startRes.body.run_id;
            let runState = await pollWorkflowRunStatus(runId, 'in_progress', 20, 200);
            expect(runState.current_step_name).toBe('fallback_human_step');
            expect(runState.results_json.callError).toBeDefined();
            expect(runState.results_json.callError.message).toContain("External API call"); // Message now includes template
            expect(runState.results_json.callError.retry_attempts_made).toBe(1);
            await completeHumanTask(runId, "fallback_human_step", { resolution_fb: "manual_override_approved_fb" });
            const finalRunState = await pollWorkflowRunStatus(runId, 'completed', 10, 200);
            expect(finalRunState.status).toBe('completed'); expect(finalRunState.current_step_name).toBe('end_fallback_handled');
            expect(finalRunState.results_json.fallback_out.resolution_fb).toBe("manual_override_approved_fb");
            expect(nock.isDone()).toBe(true);
        }, 20000);
    });

    describe('Scenario 3c: Error Handling - No Retry, Continue with Error', () => {
        let continueWorkflowId: string; const continueWorkflowName = `E2E Error Continue Test ${Date.now()}`;
        const mockApiHostContinue = 'http://localhost:1236'; const mockApiPathContinue = '/api/fails_but_continue';
        const continueWorkflowDef = { name: continueWorkflowName, definition_json: { start_step: "api_call_can_fail", steps: [ { name: "api_call_can_fail", type: "external_api_call" as const, external_api_call_config: { url_template: `${mockApiHostContinue}${mockApiPathContinue}`, method: "GET" as const, success_criteria: { status_codes: [200] }, }, error_handling: { on_failure: { action: "continue_with_error" as const, error_output_namespace: "apiFault" } }, transitions: [{ to: "next_step_after_api", condition_type: "always" as const }] }, { name: "next_step_after_api", type: "human_review" as const, assigned_role: "reviewer", output_namespace: "review_out", transitions: [{to: "end_continue", condition_type: "always" as const}] }, { name: "end_continue", type: "end" as const, final_status: "completed" as const } ] }, is_active: true };
        let nockScopeContinue: import('nock').Scope;
        beforeAll(async () => { nockScopeContinue = nock(mockApiHostContinue).persist(); const createRes = await request(app).post('/api/admin/workflows').set('Authorization', `Bearer ${adminToken}`).send(continueWorkflowDef); expect(createRes.status).toBe(201); continueWorkflowId = createRes.body.workflow_id; });
        afterAll(() => { nock.cleanAll(); });
        test('should not retry, continue to next step with error in output, then complete', async () => {
            nockScopeContinue.get(mockApiPathContinue).reply(404, { error_message: "Resource not found" });
            const startRes = await request(app).post(`/api/workflows/${continueWorkflowId}/start`).set('Authorization', `Bearer ${adminToken}`).send({ triggering_data_json: { testId: "continue-123" } });
            expect(startRes.status).toBe(201); const runId = startRes.body.run_id;
            let runStateAfterApiCall = await pollWorkflowRunStatus(runId, 'in_progress');
            expect(runStateAfterApiCall.current_step_name).toBe('next_step_after_api');
            expect(runStateAfterApiCall.results_json.apiFault).toBeDefined();
            expect(runStateAfterApiCall.results_json.apiFault.message).toContain("External API call");
            expect(runStateAfterApiCall.results_json.apiFault.response_data.status).toBe(404);
            expect(runStateAfterApiCall.results_json.apiFault.retry_attempts_made).toBe(0);
            await completeHumanTask(runId, "next_step_after_api", { review_data_continue: "processed_despite_api_error_continue" });
            const finalRunState = await pollWorkflowRunStatus(runId, 'completed', 10, 200);
            expect(finalRunState.status).toBe('completed'); expect(finalRunState.current_step_name).toBe('end_continue');
            expect(finalRunState.results_json.review_out.review_data_continue).toBe("processed_despite_api_error_continue");
            expect(nock.isDone()).toBe(true);
        }, 15000);
    });

    // Scenario 4: Scheduled Trigger (TODO)
    // Scenario 5: Webhook Trigger & External API Call Step (TODO)

});
