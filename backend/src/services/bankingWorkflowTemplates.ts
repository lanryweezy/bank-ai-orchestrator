// Banking-specific workflow templates for core banking operations
// These templates provide pre-built workflows for common banking processes

export const bankingWorkflowTemplates = {
    // Customer Onboarding Workflow
    customerOnboarding: {
        name: "Customer Onboarding",
        description: "Complete customer onboarding process with KYC, BVN verification, and account opening",
        version: 1,
        definition_json: {
            start_step: "collect_customer_data",
            steps: [
                {
                    name: "collect_customer_data",
                    type: "data_input",
                    description: "Collect customer personal and contact information",
                    assigned_role: "customer_service",
                    form_schema: {
                        title: "Customer Information",
                        type: "object",
                        properties: {
                            first_name: { type: "string", title: "First Name" },
                            last_name: { type: "string", title: "Last Name" },
                            date_of_birth: { type: "string", format: "date", title: "Date of Birth" },
                            email: { type: "string", format: "email", title: "Email Address" },
                            phone_primary: { type: "string", title: "Primary Phone" },
                            bvn: { type: "string", title: "BVN", maxLength: 11 },
                            address_line1: { type: "string", title: "Address" },
                            city: { type: "string", title: "City" },
                            state: { type: "string", title: "State" }
                        },
                        required: ["first_name", "last_name", "date_of_birth", "email", "phone_primary", "address_line1", "city", "state"]
                    },
                    transitions: [
                        { to: "verify_identity", condition_type: "always" }
                    ]
                },
                {
                    name: "verify_identity",
                    type: "parallel",
                    description: "Parallel identity verification processes",
                    branches: [
                        {
                            name: "bvn_verification",
                            start_step: "verify_bvn",
                            steps: [
                                {
                                    name: "verify_bvn",
                                    type: "agent_execution",
                                    description: "Verify Bank Verification Number",
                                    agent_core_logic_identifier: "bvn_verifier",
                                    transitions: [{ to: "join_verification", condition_type: "always" }]
                                }
                            ]
                        },
                        {
                            name: "sanctions_screening",
                            start_step: "screen_sanctions",
                            steps: [
                                {
                                    name: "screen_sanctions",
                                    type: "agent_execution",
                                    description: "Screen customer against sanctions lists",
                                    agent_core_logic_identifier: "sanctions_screener",
                                    transitions: [{ to: "join_verification", condition_type: "always" }]
                                }
                            ]
                        }
                    ],
                    join_on: "join_verification"
                },
                {
                    name: "join_verification",
                    type: "join",
                    description: "Synchronize identity verification results",
                    transitions: [
                        { to: "kyc_review", condition_type: "always" }
                    ]
                },
                {
                    name: "kyc_review",
                    type: "human_review",
                    description: "Manual KYC review and decision",
                    assigned_role: "compliance_officer",
                    form_schema: {
                        title: "KYC Review",
                        type: "object",
                        properties: {
                            kyc_decision: {
                                type: "string",
                                enum: ["approved", "rejected", "requires_more_info"],
                                title: "KYC Decision"
                            },
                            customer_tier: {
                                type: "string",
                                enum: ["Tier 1", "Tier 2", "Tier 3"],
                                title: "Customer Tier"
                            },
                            notes: { type: "string", title: "Review Notes" }
                        },
                        required: ["kyc_decision"]
                    },
                    transitions: [
                        { to: "create_customer", condition_type: "on_output_value", field: "kyc_decision", operator: "==", value: "approved" },
                        { to: "rejection_notice", condition_type: "on_output_value", field: "kyc_decision", operator: "==", value: "rejected" },
                        { to: "request_additional_info", condition_type: "on_output_value", field: "kyc_decision", operator: "==", value: "requires_more_info" }
                    ]
                },
                {
                    name: "create_customer",
                    type: "agent_execution",
                    description: "Create customer record in core banking system",
                    agent_core_logic_identifier: "customer_creator",
                    transitions: [
                        { to: "account_opening_decision", condition_type: "always" }
                    ]
                },
                {
                    name: "account_opening_decision",
                    type: "decision",
                    description: "Determine if customer wants to open account immediately",
                    transitions: [
                        { to: "open_account_workflow", condition_type: "on_output_value", field: "open_account", operator: "==", value: true },
                        { to: "onboarding_complete", condition_type: "always" }
                    ]
                },
                {
                    name: "open_account_workflow",
                    type: "sub_workflow",
                    description: "Execute account opening sub-workflow",
                    sub_workflow_name: "Account Opening",
                    sub_workflow_version: 1,
                    input_mapping: {
                        "customer_id": "customer.customer_id",
                        "customer_tier": "kyc_review.customer_tier"
                    },
                    transitions: [
                        { to: "onboarding_complete", condition_type: "always" }
                    ]
                },
                {
                    name: "request_additional_info",
                    type: "agent_execution",
                    description: "Send request for additional KYC information",
                    agent_core_logic_identifier: "info_requester",
                    transitions: [
                        { to: "collect_customer_data", condition_type: "always" }
                    ]
                },
                {
                    name: "rejection_notice",
                    type: "agent_execution",
                    description: "Send customer rejection notification",
                    agent_core_logic_identifier: "rejection_notifier",
                    transitions: [
                        { to: "onboarding_rejected", condition_type: "always" }
                    ]
                },
                {
                    name: "onboarding_complete",
                    type: "end",
                    final_status: "approved"
                },
                {
                    name: "onboarding_rejected",
                    type: "end",
                    final_status: "rejected"
                }
            ]
        }
    },

    // Loan Application Processing Workflow
    loanProcessing: {
        name: "Loan Application Processing",
        description: "Complete loan application processing with credit scoring, approval, and disbursement",
        version: 1,
        definition_json: {
            start_step: "application_submission",
            steps: [
                {
                    name: "application_submission",
                    type: "data_input",
                    description: "Collect loan application information",
                    assigned_role: "loan_officer",
                    form_schema: {
                        title: "Loan Application",
                        type: "object",
                        properties: {
                            customer_id: { type: "string", title: "Customer ID" },
                            loan_product: { type: "string", enum: ["personal", "business", "mortgage", "vehicle"], title: "Loan Type" },
                            requested_amount: { type: "number", title: "Requested Amount", minimum: 10000 },
                            tenure_months: { type: "number", title: "Loan Tenure (Months)", minimum: 6, maximum: 360 },
                            purpose: { type: "string", title: "Loan Purpose" },
                            monthly_income: { type: "number", title: "Monthly Income" },
                            employment_status: { type: "string", enum: ["employed", "self_employed", "business_owner"], title: "Employment Status" },
                            collateral_type: { type: "string", title: "Collateral Type (if any)" },
                            collateral_value: { type: "number", title: "Collateral Value" }
                        },
                        required: ["customer_id", "loan_product", "requested_amount", "tenure_months", "purpose", "monthly_income", "employment_status"]
                    },
                    transitions: [
                        { to: "initial_checks", condition_type: "always" }
                    ]
                },
                {
                    name: "initial_checks",
                    type: "parallel",
                    description: "Parallel initial verification processes",
                    branches: [
                        {
                            name: "customer_verification",
                            start_step: "verify_customer",
                            steps: [
                                {
                                    name: "verify_customer",
                                    type: "agent_execution",
                                    description: "Verify customer existence and status",
                                    agent_core_logic_identifier: "customer_verifier",
                                    transitions: [{ to: "join_initial_checks", condition_type: "always" }]
                                }
                            ]
                        },
                        {
                            name: "credit_scoring",
                            start_step: "calculate_credit_score",
                            steps: [
                                {
                                    name: "calculate_credit_score",
                                    type: "agent_execution",
                                    description: "Calculate customer credit score",
                                    agent_core_logic_identifier: "credit_scorer",
                                    transitions: [{ to: "join_initial_checks", condition_type: "always" }]
                                }
                            ]
                        },
                        {
                            name: "affordability_check",
                            start_step: "check_affordability",
                            steps: [
                                {
                                    name: "check_affordability",
                                    type: "agent_execution",
                                    description: "Check loan affordability based on income",
                                    agent_core_logic_identifier: "affordability_checker",
                                    transitions: [{ to: "join_initial_checks", condition_type: "always" }]
                                }
                            ]
                        }
                    ],
                    join_on: "join_initial_checks"
                },
                {
                    name: "join_initial_checks",
                    type: "join",
                    description: "Synchronize initial check results",
                    transitions: [
                        { to: "automated_decision", condition_type: "always" }
                    ]
                },
                {
                    name: "automated_decision",
                    type: "agent_execution",
                    description: "Automated loan decision based on scoring rules",
                    agent_core_logic_identifier: "loan_decision_engine",
                    transitions: [
                        { to: "auto_approved", condition_type: "on_output_value", field: "decision", operator: "==", value: "auto_approved" },
                        { to: "auto_rejected", condition_type: "on_output_value", field: "decision", operator: "==", value: "auto_rejected" },
                        { to: "manual_review", condition_type: "on_output_value", field: "decision", operator: "==", value: "requires_review" }
                    ]
                },
                {
                    name: "manual_review",
                    type: "human_review",
                    description: "Manual loan application review",
                    assigned_role: "credit_analyst",
                    form_schema: {
                        title: "Loan Review",
                        type: "object",
                        properties: {
                            approval_decision: {
                                type: "string",
                                enum: ["approved", "rejected", "approved_with_conditions"],
                                title: "Approval Decision"
                            },
                            approved_amount: { type: "number", title: "Approved Amount" },
                            interest_rate: { type: "number", title: "Interest Rate (%)" },
                            conditions: { type: "string", title: "Approval Conditions" },
                            reviewer_notes: { type: "string", title: "Reviewer Notes" }
                        },
                        required: ["approval_decision"]
                    },
                    transitions: [
                        { to: "committee_review", condition_type: "on_output_value", field: "approved_amount", operator: ">", value: 1000000 },
                        { to: "approved", condition_type: "on_output_value", field: "approval_decision", operator: "==", value: "approved" },
                        { to: "approved_with_conditions", condition_type: "on_output_value", field: "approval_decision", operator: "==", value: "approved_with_conditions" },
                        { to: "rejected", condition_type: "on_output_value", field: "approval_decision", operator: "==", value: "rejected" }
                    ]
                },
                {
                    name: "committee_review",
                    type: "human_review",
                    description: "Credit committee review for high-value loans",
                    assigned_role: "credit_committee",
                    form_schema: {
                        title: "Credit Committee Review",
                        type: "object",
                        properties: {
                            committee_decision: {
                                type: "string",
                                enum: ["approved", "rejected", "deferred"],
                                title: "Committee Decision"
                            },
                            committee_notes: { type: "string", title: "Committee Notes" }
                        },
                        required: ["committee_decision"]
                    },
                    transitions: [
                        { to: "approved", condition_type: "on_output_value", field: "committee_decision", operator: "==", value: "approved" },
                        { to: "rejected", condition_type: "on_output_value", field: "committee_decision", operator: "==", value: "rejected" },
                        { to: "deferred", condition_type: "on_output_value", field: "committee_decision", operator: "==", value: "deferred" }
                    ]
                },
                {
                    name: "auto_approved",
                    type: "agent_execution",
                    description: "Process automatic approval",
                    agent_core_logic_identifier: "auto_approval_processor",
                    transitions: [
                        { to: "generate_loan_documents", condition_type: "always" }
                    ]
                },
                {
                    name: "approved",
                    type: "agent_execution",
                    description: "Process manual approval",
                    agent_core_logic_identifier: "manual_approval_processor",
                    transitions: [
                        { to: "generate_loan_documents", condition_type: "always" }
                    ]
                },
                {
                    name: "approved_with_conditions",
                    type: "agent_execution",
                    description: "Process conditional approval",
                    agent_core_logic_identifier: "conditional_approval_processor",
                    transitions: [
                        { to: "collect_additional_documents", condition_type: "always" }
                    ]
                },
                {
                    name: "collect_additional_documents",
                    type: "data_input",
                    description: "Collect additional documents for conditional approval",
                    assigned_role: "loan_officer",
                    transitions: [
                        { to: "verify_conditions", condition_type: "always" }
                    ]
                },
                {
                    name: "verify_conditions",
                    type: "human_review",
                    description: "Verify that approval conditions are met",
                    assigned_role: "credit_analyst",
                    transitions: [
                        { to: "generate_loan_documents", condition_type: "on_output_value", field: "conditions_met", operator: "==", value: true },
                        { to: "rejected", condition_type: "on_output_value", field: "conditions_met", operator: "==", value: false }
                    ]
                },
                {
                    name: "generate_loan_documents",
                    type: "agent_execution",
                    description: "Generate loan agreement and supporting documents",
                    agent_core_logic_identifier: "document_generator",
                    transitions: [
                        { to: "customer_acceptance", condition_type: "always" }
                    ]
                },
                {
                    name: "customer_acceptance",
                    type: "data_input",
                    description: "Customer loan agreement acceptance",
                    assigned_role: "customer_service",
                    form_schema: {
                        title: "Loan Agreement Acceptance",
                        type: "object",
                        properties: {
                            customer_accepted: { type: "boolean", title: "Customer Accepted Terms" },
                            signing_date: { type: "string", format: "date", title: "Signing Date" },
                            customer_signature: { type: "string", title: "Customer Signature (Digital)" }
                        },
                        required: ["customer_accepted"]
                    },
                    transitions: [
                        { to: "disburse_loan", condition_type: "on_output_value", field: "customer_accepted", operator: "==", value: true },
                        { to: "customer_declined", condition_type: "on_output_value", field: "customer_accepted", operator: "==", value: false }
                    ]
                },
                {
                    name: "disburse_loan",
                    type: "agent_execution",
                    description: "Disburse approved loan amount",
                    agent_core_logic_identifier: "loan_disbursement",
                    transitions: [
                        { to: "loan_approved", condition_type: "always" }
                    ]
                },
                {
                    name: "auto_rejected",
                    type: "agent_execution",
                    description: "Process automatic rejection",
                    agent_core_logic_identifier: "auto_rejection_processor",
                    transitions: [
                        { to: "loan_rejected", condition_type: "always" }
                    ]
                },
                {
                    name: "rejected",
                    type: "agent_execution",
                    description: "Process manual rejection",
                    agent_core_logic_identifier: "manual_rejection_processor",
                    transitions: [
                        { to: "loan_rejected", condition_type: "always" }
                    ]
                },
                {
                    name: "deferred",
                    type: "agent_execution",
                    description: "Process loan deferral",
                    agent_core_logic_identifier: "loan_deferral_processor",
                    transitions: [
                        { to: "loan_deferred", condition_type: "always" }
                    ]
                },
                {
                    name: "customer_declined",
                    type: "agent_execution",
                    description: "Process customer decline",
                    agent_core_logic_identifier: "customer_decline_processor",
                    transitions: [
                        { to: "loan_declined_by_customer", condition_type: "always" }
                    ]
                },
                {
                    name: "loan_approved",
                    type: "end",
                    final_status: "approved"
                },
                {
                    name: "loan_rejected",
                    type: "end",
                    final_status: "rejected"
                },
                {
                    name: "loan_deferred",
                    type: "end",
                    final_status: "deferred"
                },
                {
                    name: "loan_declined_by_customer",
                    type: "end",
                    final_status: "declined"
                }
            ]
        }
    },

    // Account Opening Workflow
    accountOpening: {
        name: "Account Opening",
        description: "Account opening process for existing customers",
        version: 1,
        definition_json: {
            start_step: "select_account_type",
            steps: [
                {
                    name: "select_account_type",
                    type: "data_input",
                    description: "Select account type and collect requirements",
                    assigned_role: "customer_service",
                    form_schema: {
                        title: "Account Opening",
                        type: "object",
                        properties: {
                            customer_id: { type: "string", title: "Customer ID" },
                            account_type: { type: "string", enum: ["savings", "current", "fixed_deposit"], title: "Account Type" },
                            initial_deposit: { type: "number", title: "Initial Deposit", minimum: 0 },
                            account_name: { type: "string", title: "Account Name" },
                            requires_two_signatures: { type: "boolean", title: "Requires Two Signatures" },
                            monthly_transaction_limit: { type: "number", title: "Monthly Transaction Limit" }
                        },
                        required: ["customer_id", "account_type", "initial_deposit", "account_name"]
                    },
                    transitions: [
                        { to: "validate_requirements", condition_type: "always" }
                    ]
                },
                {
                    name: "validate_requirements",
                    type: "agent_execution",
                    description: "Validate account opening requirements",
                    agent_core_logic_identifier: "account_requirement_validator",
                    transitions: [
                        { to: "create_account", condition_type: "on_output_value", field: "validation_passed", operator: "==", value: true },
                        { to: "requirements_failed", condition_type: "on_output_value", field: "validation_passed", operator: "==", value: false }
                    ]
                },
                {
                    name: "create_account",
                    type: "agent_execution",
                    description: "Create new bank account",
                    agent_core_logic_identifier: "account_creator",
                    transitions: [
                        { to: "generate_account_kit", condition_type: "always" }
                    ]
                },
                {
                    name: "generate_account_kit",
                    type: "agent_execution",
                    description: "Generate account welcome kit and documents",
                    agent_core_logic_identifier: "account_kit_generator",
                    transitions: [
                        { to: "card_request_decision", condition_type: "always" }
                    ]
                },
                {
                    name: "card_request_decision",
                    type: "decision",
                    description: "Check if customer wants a debit card",
                    transitions: [
                        { to: "card_issuance_workflow", condition_type: "on_output_value", field: "issue_card", operator: "==", value: true },
                        { to: "account_opened", condition_type: "always" }
                    ]
                },
                {
                    name: "card_issuance_workflow",
                    type: "sub_workflow",
                    description: "Issue debit card for new account",
                    sub_workflow_name: "Card Issuance",
                    sub_workflow_version: 1,
                    input_mapping: {
                        "account_id": "create_account.account_id",
                        "card_type": "debit"
                    },
                    transitions: [
                        { to: "account_opened", condition_type: "always" }
                    ]
                },
                {
                    name: "requirements_failed",
                    type: "agent_execution",
                    description: "Notify about failed requirements",
                    agent_core_logic_identifier: "requirement_failure_notifier",
                    transitions: [
                        { to: "account_opening_failed", condition_type: "always" }
                    ]
                },
                {
                    name: "account_opened",
                    type: "end",
                    final_status: "completed"
                },
                {
                    name: "account_opening_failed",
                    type: "end",
                    final_status: "failed"
                }
            ]
        }
    },

    // Transaction Monitoring Workflow
    transactionMonitoring: {
        name: "Transaction Monitoring",
        description: "Real-time transaction monitoring for AML compliance",
        version: 1,
        definition_json: {
            start_step: "analyze_transaction",
            steps: [
                {
                    name: "analyze_transaction",
                    type: "agent_execution",
                    description: "Analyze transaction for suspicious patterns",
                    agent_core_logic_identifier: "transaction_analyzer",
                    transitions: [
                        { to: "high_risk_review", condition_type: "on_output_value", field: "risk_level", operator: "==", value: "high" },
                        { to: "medium_risk_check", condition_type: "on_output_value", field: "risk_level", operator: "==", value: "medium" },
                        { to: "transaction_cleared", condition_type: "on_output_value", field: "risk_level", operator: "==", value: "low" }
                    ]
                },
                {
                    name: "medium_risk_check",
                    type: "agent_execution",
                    description: "Additional automated checks for medium risk transactions",
                    agent_core_logic_identifier: "medium_risk_analyzer",
                    transitions: [
                        { to: "high_risk_review", condition_type: "on_output_value", field: "escalate", operator: "==", value: true },
                        { to: "transaction_cleared", condition_type: "on_output_value", field: "escalate", operator: "==", value: false }
                    ]
                },
                {
                    name: "high_risk_review",
                    type: "human_review",
                    description: "Manual review of high-risk transaction",
                    assigned_role: "aml_analyst",
                    form_schema: {
                        title: "AML Transaction Review",
                        type: "object",
                        properties: {
                            review_decision: {
                                type: "string",
                                enum: ["approve", "reject", "investigate_further", "file_sar"],
                                title: "Review Decision"
                            },
                            risk_assessment: { type: "string", title: "Risk Assessment" },
                            reviewer_notes: { type: "string", title: "Review Notes" }
                        },
                        required: ["review_decision"]
                    },
                    transitions: [
                        { to: "transaction_approved", condition_type: "on_output_value", field: "review_decision", operator: "==", value: "approve" },
                        { to: "transaction_rejected", condition_type: "on_output_value", field: "review_decision", operator: "==", value: "reject" },
                        { to: "investigation_workflow", condition_type: "on_output_value", field: "review_decision", operator: "==", value: "investigate_further" },
                        { to: "file_sar_report", condition_type: "on_output_value", field: "review_decision", operator: "==", value: "file_sar" }
                    ]
                },
                {
                    name: "investigation_workflow",
                    type: "sub_workflow",
                    description: "Launch detailed AML investigation",
                    sub_workflow_name: "AML Investigation",
                    sub_workflow_version: 1,
                    transitions: [
                        { to: "investigation_complete", condition_type: "always" }
                    ]
                },
                {
                    name: "file_sar_report",
                    type: "agent_execution",
                    description: "File Suspicious Activity Report",
                    agent_core_logic_identifier: "sar_filer",
                    transitions: [
                        { to: "sar_filed", condition_type: "always" }
                    ]
                },
                {
                    name: "transaction_cleared",
                    type: "end",
                    final_status: "approved"
                },
                {
                    name: "transaction_approved",
                    type: "end",
                    final_status: "approved"
                },
                {
                    name: "transaction_rejected",
                    type: "end",
                    final_status: "rejected"
                },
                {
                    name: "investigation_complete",
                    type: "end",
                    final_status: "under_investigation"
                },
                {
                    name: "sar_filed",
                    type: "end",
                    final_status: "sar_filed"
                }
            ]
        }
    }
};

// Function to seed banking workflow templates
export const seedBankingWorkflowTemplates = async (query: any) => {
    try {
        console.log('Seeding banking workflow templates...');
        
        for (const [key, template] of Object.entries(bankingWorkflowTemplates)) {
            // Check if workflow already exists
            const existingWorkflow = await query(
                'SELECT workflow_id FROM workflows WHERE name = $1 AND version = $2',
                [template.name, template.version]
            );
            
            if (existingWorkflow.rows.length === 0) {
                // Insert new workflow template
                await query(
                    `INSERT INTO workflows (name, version, description, definition_json, status, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        template.name,
                        template.version,
                        template.description,
                        JSON.stringify(template.definition_json),
                        'active',
                        true
                    ]
                );
                console.log(`Created banking workflow template: ${template.name}`);
            } else {
                console.log(`Banking workflow template already exists: ${template.name}`);
            }
        }
        
        console.log('Banking workflow templates seeding completed');
    } catch (error) {
        console.error('Error seeding banking workflow templates:', error);
        throw error;
    }
};