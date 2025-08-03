-- Core Banking System Database Schema
-- Comprehensive schema for full banking operations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- CUSTOMER MANAGEMENT
-- ============================================================================

-- Enhanced Users/Customers Table
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_number VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(10), -- Mr, Mrs, Dr, etc.
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
    nationality VARCHAR(50) DEFAULT 'Nigerian',
    
    -- Identity Information
    bvn VARCHAR(11) UNIQUE,
    nin VARCHAR(11) UNIQUE,
    passport_number VARCHAR(20),
    drivers_license VARCHAR(20),
    
    -- Contact Information
    email VARCHAR(255) UNIQUE,
    phone_primary VARCHAR(20) NOT NULL,
    phone_secondary VARCHAR(20),
    
    -- Address Information
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(10),
    country VARCHAR(50) DEFAULT 'Nigeria',
    
    -- Employment Information
    employer_name VARCHAR(200),
    employer_address VARCHAR(500),
    occupation VARCHAR(100),
    employment_status VARCHAR(20) CHECK (employment_status IN ('employed', 'self_employed', 'unemployed', 'retired', 'student')),
    monthly_income DECIMAL(15,2),
    
    -- Banking Information
    customer_tier VARCHAR(20) DEFAULT 'Tier 1' CHECK (customer_tier IN ('Tier 1', 'Tier 2', 'Tier 3')),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_progress', 'verified', 'rejected', 'expired')),
    kyc_level INTEGER DEFAULT 1 CHECK (kyc_level IN (1, 2, 3)),
    risk_rating VARCHAR(20) DEFAULT 'low' CHECK (risk_rating IN ('low', 'medium', 'high')),
    
    -- Status and Flags
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'closed')),
    is_pep BOOLEAN DEFAULT FALSE, -- Politically Exposed Person
    is_staff BOOLEAN DEFAULT FALSE,
    blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT chk_age CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '18 years')
);

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_customers_bvn ON customers(bvn);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone_primary);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_kyc_status ON customers(kyc_status);
CREATE INDEX idx_customers_customer_number ON customers(customer_number);

-- ============================================================================
-- ACCOUNT MANAGEMENT
-- ============================================================================

-- Account Types Reference Table
CREATE TABLE account_types (
    account_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_code VARCHAR(10) UNIQUE NOT NULL, -- SAV, CUR, FD, LOAN
    type_name VARCHAR(50) NOT NULL, -- Savings, Current, Fixed Deposit, Loan
    description TEXT,
    interest_rate DECIMAL(5,4) DEFAULT 0,
    minimum_balance DECIMAL(15,2) DEFAULT 0,
    maximum_balance DECIMAL(15,2),
    maintenance_fee DECIMAL(10,2) DEFAULT 0,
    transaction_limit_daily DECIMAL(15,2),
    transaction_limit_monthly DECIMAL(15,2),
    withdrawal_limit_daily DECIMAL(15,2),
    allows_overdraft BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default account types
INSERT INTO account_types (type_code, type_name, description, interest_rate, minimum_balance, transaction_limit_daily) VALUES
('SAV', 'Savings Account', 'Personal savings account with interest', 0.025, 1000, 500000),
('CUR', 'Current Account', 'Business current account for transactions', 0.000, 5000, 2000000),
('FD', 'Fixed Deposit', 'Fixed deposit investment account', 0.080, 50000, 0),
('LOAN', 'Loan Account', 'Loan disbursement and repayment account', 0.000, 0, 0);

-- Main Accounts Table
CREATE TABLE accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    account_type_id UUID NOT NULL REFERENCES account_types(account_type_id),
    account_name VARCHAR(200) NOT NULL,
    
    -- Balance Information
    available_balance DECIMAL(15,2) DEFAULT 0,
    book_balance DECIMAL(15,2) DEFAULT 0,
    hold_amount DECIMAL(15,2) DEFAULT 0,
    unclearred_balance DECIMAL(15,2) DEFAULT 0,
    
    -- Account Configuration
    currency VARCHAR(3) DEFAULT 'NGN',
    interest_rate DECIMAL(5,4), -- Override account type rate if needed
    overdraft_limit DECIMAL(15,2) DEFAULT 0,
    daily_transaction_limit DECIMAL(15,2),
    monthly_transaction_limit DECIMAL(15,2),
    
    -- Status and Flags
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'frozen', 'closed', 'dormant')),
    is_joint_account BOOLEAN DEFAULT FALSE,
    requires_two_signatures BOOLEAN DEFAULT FALSE,
    auto_sweep_enabled BOOLEAN DEFAULT FALSE,
    sms_alerts_enabled BOOLEAN DEFAULT TRUE,
    email_alerts_enabled BOOLEAN DEFAULT TRUE,
    
    -- Important Dates
    date_opened DATE DEFAULT CURRENT_DATE,
    date_closed DATE,
    last_transaction_date DATE,
    last_statement_date DATE,
    
    -- Metadata
    branch_code VARCHAR(10),
    account_officer_id UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_balance_positive CHECK (available_balance >= -overdraft_limit),
    CONSTRAINT chk_account_dates CHECK (date_closed IS NULL OR date_closed >= date_opened)
);

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_accounts_customer_id ON accounts(customer_id);
CREATE INDEX idx_accounts_account_number ON accounts(account_number);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);
CREATE INDEX idx_accounts_balance ON accounts(available_balance);

-- ============================================================================
-- TRANSACTION MANAGEMENT
-- ============================================================================

-- Transaction Types Reference
CREATE TABLE transaction_types (
    transaction_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_code VARCHAR(10) UNIQUE NOT NULL, -- DEP, WTH, TRF, FEE, INT
    type_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_debit BOOLEAN NOT NULL,
    requires_authorization BOOLEAN DEFAULT FALSE,
    transaction_fee DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO transaction_types (type_code, type_name, description, is_debit) VALUES
('DEP', 'Deposit', 'Cash or check deposit', FALSE),
('WTH', 'Withdrawal', 'Cash withdrawal', TRUE),
('TRF_OUT', 'Transfer Out', 'Outbound transfer', TRUE),
('TRF_IN', 'Transfer In', 'Inbound transfer', FALSE),
('FEE', 'Service Fee', 'Bank service charges', TRUE),
('INT', 'Interest Credit', 'Interest payment', FALSE),
('REV', 'Reversal', 'Transaction reversal', FALSE);

-- Main Transactions Table
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Account Information
    account_id UUID NOT NULL REFERENCES accounts(account_id),
    transaction_type_id UUID NOT NULL REFERENCES transaction_types(transaction_type_id),
    
    -- Transaction Details
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    transaction_fee DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(15,2) GENERATED ALWAYS AS (
        CASE 
            WHEN (SELECT is_debit FROM transaction_types WHERE transaction_type_id = transactions.transaction_type_id) 
            THEN -(amount + transaction_fee) 
            ELSE amount 
        END
    ) STORED,
    
    -- Balance Information
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    
    -- Transaction Context
    description TEXT NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('branch', 'atm', 'pos', 'ussd', 'mobile_app', 'internet_banking', 'agent', 'api')),
    location VARCHAR(200),
    device_info JSONB,
    
    -- Counterparty Information (for transfers)
    beneficiary_account_number VARCHAR(20),
    beneficiary_name VARCHAR(200),
    beneficiary_bank_code VARCHAR(10),
    originator_account_number VARCHAR(20),
    originator_name VARCHAR(200),
    originator_bank_code VARCHAR(10),
    
    -- Status and Processing
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled')),
    authorization_code VARCHAR(50),
    processing_code VARCHAR(10),
    response_code VARCHAR(5),
    response_message TEXT,
    
    -- Important Dates
    transaction_date DATE DEFAULT CURRENT_DATE,
    value_date DATE DEFAULT CURRENT_DATE,
    processing_date DATE,
    
    -- Linked Transactions
    parent_transaction_id UUID REFERENCES transactions(transaction_id),
    reversal_transaction_id UUID REFERENCES transactions(transaction_id),
    
    -- Audit Trail
    initiated_by UUID,
    authorized_by UUID,
    processed_by UUID,
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure balance calculation is correct
    CONSTRAINT chk_balance_calculation CHECK (
        balance_after = balance_before + net_amount
    )
);

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_reference ON transactions(reference_number);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_amount ON transactions(amount);
CREATE INDEX idx_transactions_channel ON transactions(channel);
CREATE INDEX idx_transactions_beneficiary ON transactions(beneficiary_account_number);

-- ============================================================================
-- CARD MANAGEMENT
-- ============================================================================

-- Card Types Reference
CREATE TABLE card_types (
    card_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_code VARCHAR(10) UNIQUE NOT NULL, -- DEBIT, CREDIT, PREPAID
    type_name VARCHAR(50) NOT NULL,
    card_scheme VARCHAR(20) CHECK (card_scheme IN ('visa', 'mastercard', 'verve', 'union_pay')),
    annual_fee DECIMAL(10,2) DEFAULT 0,
    issuance_fee DECIMAL(10,2) DEFAULT 0,
    replacement_fee DECIMAL(10,2) DEFAULT 0,
    daily_limit DECIMAL(15,2) DEFAULT 100000,
    monthly_limit DECIMAL(15,2) DEFAULT 1000000,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO card_types (type_code, type_name, card_scheme, daily_limit) VALUES
('DEBIT', 'Debit Card', 'verve', 200000),
('CREDIT', 'Credit Card', 'visa', 500000),
('PREPAID', 'Prepaid Card', 'mastercard', 100000);

-- Cards Table
CREATE TABLE cards (
    card_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_number VARCHAR(19) UNIQUE NOT NULL, -- Encrypted/Masked
    card_number_hash VARCHAR(64) UNIQUE NOT NULL, -- Hash for lookups
    account_id UUID NOT NULL REFERENCES accounts(account_id),
    card_type_id UUID NOT NULL REFERENCES card_types(card_type_id),
    
    -- Card Details
    card_holder_name VARCHAR(200) NOT NULL,
    expiry_month INTEGER NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
    expiry_year INTEGER NOT NULL CHECK (expiry_year >= EXTRACT(YEAR FROM CURRENT_DATE)),
    cvv_hash VARCHAR(64), -- Hashed CVV
    
    -- PIN Information
    pin_hash VARCHAR(128), -- Hashed PIN
    pin_tries_count INTEGER DEFAULT 0,
    pin_blocked_until TIMESTAMP WITH TIME ZONE,
    
    -- Limits and Configuration
    daily_limit DECIMAL(15,2),
    monthly_limit DECIMAL(15,2),
    pos_enabled BOOLEAN DEFAULT TRUE,
    atm_enabled BOOLEAN DEFAULT TRUE,
    online_enabled BOOLEAN DEFAULT TRUE,
    international_enabled BOOLEAN DEFAULT FALSE,
    contactless_enabled BOOLEAN DEFAULT TRUE,
    
    -- Status Information
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'blocked', 'expired', 'lost', 'stolen', 'damaged')),
    activation_date DATE,
    last_used_date DATE,
    block_reason TEXT,
    
    -- Physical Card Information
    card_variant VARCHAR(50), -- Classic, Gold, Platinum
    is_virtual BOOLEAN DEFAULT FALSE,
    delivery_address TEXT,
    delivery_status VARCHAR(20) CHECK (delivery_status IN ('pending', 'dispatched', 'delivered', 'returned')),
    
    -- Metadata
    issued_date DATE DEFAULT CURRENT_DATE,
    replacement_for_card_id UUID REFERENCES cards(card_id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_cards_updated_at
    BEFORE UPDATE ON cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_cards_account_id ON cards(account_id);
CREATE INDEX idx_cards_hash ON cards(card_number_hash);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_cards_expiry ON cards(expiry_year, expiry_month);

-- ============================================================================
-- LOAN MANAGEMENT
-- ============================================================================

-- Loan Products
CREATE TABLE loan_products (
    loan_product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code VARCHAR(20) UNIQUE NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Interest and Fees
    interest_rate_min DECIMAL(5,4) NOT NULL,
    interest_rate_max DECIMAL(5,4) NOT NULL,
    processing_fee_rate DECIMAL(5,4) DEFAULT 0,
    insurance_rate DECIMAL(5,4) DEFAULT 0,
    
    -- Loan Parameters
    min_amount DECIMAL(15,2) NOT NULL,
    max_amount DECIMAL(15,2) NOT NULL,
    min_tenure_months INTEGER NOT NULL,
    max_tenure_months INTEGER NOT NULL,
    
    -- Requirements
    min_income DECIMAL(15,2),
    collateral_required BOOLEAN DEFAULT FALSE,
    guarantor_required BOOLEAN DEFAULT FALSE,
    min_guarantors INTEGER DEFAULT 0,
    
    -- Configuration
    auto_approval_limit DECIMAL(15,2) DEFAULT 0,
    requires_committee_approval BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Loan Applications
CREATE TABLE loan_applications (
    application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    loan_product_id UUID NOT NULL REFERENCES loan_products(loan_product_id),
    
    -- Application Details
    requested_amount DECIMAL(15,2) NOT NULL,
    approved_amount DECIMAL(15,2),
    tenure_months INTEGER NOT NULL,
    interest_rate DECIMAL(5,4),
    purpose TEXT NOT NULL,
    
    -- Employment Information
    employer_name VARCHAR(200),
    employment_type VARCHAR(50),
    monthly_salary DECIMAL(15,2),
    years_of_employment INTEGER,
    
    -- Collateral Information
    collateral_type VARCHAR(100),
    collateral_value DECIMAL(15,2),
    collateral_description TEXT,
    
    -- Application Status
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'cancelled', 'disbursed')),
    credit_score INTEGER,
    risk_rating VARCHAR(20),
    
    -- Decision Information
    decision_reason TEXT,
    decision_date DATE,
    decision_by UUID,
    
    -- Important Dates
    application_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_loan_applications_updated_at
    BEFORE UPDATE ON loan_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Active Loans
CREATE TABLE loans (
    loan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_number VARCHAR(20) UNIQUE NOT NULL,
    application_id UUID NOT NULL REFERENCES loan_applications(application_id),
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    loan_account_id UUID NOT NULL REFERENCES accounts(account_id),
    
    -- Loan Terms
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    tenure_months INTEGER NOT NULL,
    monthly_payment DECIMAL(15,2) NOT NULL,
    
    -- Balance Information
    outstanding_principal DECIMAL(15,2) NOT NULL,
    outstanding_interest DECIMAL(15,2) DEFAULT 0,
    total_outstanding DECIMAL(15,2) GENERATED ALWAYS AS (outstanding_principal + outstanding_interest) STORED,
    total_paid DECIMAL(15,2) DEFAULT 0,
    
    -- Payment Information
    payment_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (payment_frequency IN ('weekly', 'monthly', 'quarterly')),
    next_payment_date DATE,
    last_payment_date DATE,
    maturity_date DATE NOT NULL,
    
    -- Status Information
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'defaulted', 'written_off', 'restructured')),
    days_in_arrears INTEGER DEFAULT 0,
    classification VARCHAR(20) DEFAULT 'performing' CHECK (classification IN ('performing', 'substandard', 'doubtful', 'lost')),
    
    -- Disbursement Information
    disbursement_date DATE,
    disbursement_account_id UUID REFERENCES accounts(account_id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLIANCE AND MONITORING
-- ============================================================================

-- AML Transaction Monitoring
CREATE TABLE aml_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(transaction_id),
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    
    -- Alert Details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('high_value', 'suspicious_pattern', 'velocity', 'sanctions_match', 'pep_transaction', 'cash_threshold')),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    alert_data JSONB,
    
    -- Investigation
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'closed', 'escalated', 'false_positive')),
    assigned_to UUID,
    investigation_notes TEXT,
    resolution TEXT,
    
    -- SAR Filing
    sar_filed BOOLEAN DEFAULT FALSE,
    sar_reference VARCHAR(50),
    sar_filed_date DATE,
    
    -- Dates
    alert_date DATE DEFAULT CURRENT_DATE,
    closed_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sanctions Screening
CREATE TABLE sanctions_lists (
    list_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_name VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL, -- OFAC, UN, EU, Local
    last_updated DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE sanctioned_entities (
    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES sanctions_lists(list_id),
    entity_type VARCHAR(20) CHECK (entity_type IN ('individual', 'company', 'vessel', 'aircraft')),
    
    -- Names for matching
    primary_name VARCHAR(200) NOT NULL,
    aliases TEXT[], -- Array of alternative names
    
    -- Additional Information
    date_of_birth DATE,
    place_of_birth VARCHAR(200),
    nationality VARCHAR(50),
    identification_numbers TEXT[],
    addresses TEXT[],
    
    -- Metadata
    sanctions_date DATE,
    sanctions_reason TEXT,
    reference_number VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BRANCH AND ATM MANAGEMENT
-- ============================================================================

-- Branches
CREATE TABLE branches (
    branch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_code VARCHAR(10) UNIQUE NOT NULL,
    branch_name VARCHAR(200) NOT NULL,
    
    -- Address
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(10),
    
    -- Contact Information
    phone VARCHAR(20),
    email VARCHAR(255),
    
    -- Operational Information
    manager_id UUID,
    opening_time TIME DEFAULT '08:00:00',
    closing_time TIME DEFAULT '16:00:00',
    timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'temporarily_closed')),
    is_headquarters BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ATMs
CREATE TABLE atms (
    atm_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atm_code VARCHAR(20) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(branch_id),
    
    -- Location
    location_name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    -- Configuration
    daily_cash_limit DECIMAL(15,2) DEFAULT 500000,
    per_transaction_limit DECIMAL(15,2) DEFAULT 40000,
    currency VARCHAR(3) DEFAULT 'NGN',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_service', 'maintenance')),
    cash_level VARCHAR(20) DEFAULT 'adequate' CHECK (cash_level IN ('empty', 'low', 'adequate', 'full')),
    last_maintenance_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AUDIT AND LOGGING
-- ============================================================================

-- System Audit Log
CREATE TABLE audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    
    -- Change Details
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    -- User Context
    user_id UUID,
    user_role VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    
    -- System Context
    application VARCHAR(50),
    session_id VARCHAR(100),
    request_id VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for audit log
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- FINANCIAL PRODUCTS
-- ============================================================================

-- Fixed Deposits
CREATE TABLE fixed_deposits (
    deposit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deposit_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    account_id UUID NOT NULL REFERENCES accounts(account_id),
    
    -- Deposit Details
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    tenure_days INTEGER NOT NULL,
    maturity_amount DECIMAL(15,2) NOT NULL,
    
    -- Dates
    start_date DATE DEFAULT CURRENT_DATE,
    maturity_date DATE NOT NULL,
    last_interest_date DATE,
    
    -- Configuration
    auto_renewal BOOLEAN DEFAULT FALSE,
    early_withdrawal_penalty DECIMAL(5,4) DEFAULT 0,
    interest_payment_frequency VARCHAR(20) DEFAULT 'maturity' CHECK (interest_payment_frequency IN ('monthly', 'quarterly', 'maturity')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'matured', 'liquidated', 'rolled_over')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

-- System Parameters
CREATE TABLE system_parameters (
    parameter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parameter_key VARCHAR(100) UNIQUE NOT NULL,
    parameter_value TEXT NOT NULL,
    parameter_type VARCHAR(20) DEFAULT 'string' CHECK (parameter_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ENHANCED WORKFLOW SYSTEM INTEGRATION
-- ============================================================================

-- Add enhanced workflow tables for banking operations
-- Note: These tables extend the basic workflow system for banking-specific use cases

-- Enhanced Users Table for Banking (extends basic users table)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'bank_user' CHECK (role IN ('platform_admin', 'bank_user', 'customer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Workflows Table (extends basic workflows)
CREATE TABLE IF NOT EXISTS workflows (
    workflow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    definition_json JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
    created_by UUID REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version)
);

-- Enhanced Workflow Runs with full context support
CREATE TABLE IF NOT EXISTS workflow_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(workflow_id),
    triggering_user_id UUID REFERENCES users(user_id),
    triggering_data_json JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'in_progress', 'completed', 'failed', 'cancelled')),
    current_step_name VARCHAR(255),
    context_json JSONB, -- Enhanced: stores complete workflow context, variables, and execution state
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    results_json JSONB,
    active_parallel_branches JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES workflow_runs(run_id) ON DELETE CASCADE,
    step_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL CHECK (task_type IN ('agent_execution', 'human_review', 'data_input', 'decision')),
    assigned_role VARCHAR(100),
    assigned_user_id UUID REFERENCES users(user_id),
    input_data_json JSONB,
    form_schema_json JSONB,
    output_data_json JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_by_user_id UUID REFERENCES users(user_id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent Templates for Banking AI Agents
CREATE TABLE IF NOT EXISTS agent_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    core_logic_identifier VARCHAR(255) NOT NULL,
    configuration_schema_json JSONB NOT NULL,
    input_schema_json JSONB,
    output_schema_json JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Configured Agent Instances
CREATE TABLE IF NOT EXISTS configured_agents (
    configured_agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES agent_templates(template_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    configuration_json JSONB NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add triggers for timestamp updates
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_runs_updated_at
    BEFORE UPDATE ON workflow_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configured_agents_updated_at
    BEFORE UPDATE ON configured_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_name_version ON workflows(name, version);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_current_step ON workflow_runs(current_step_name);
CREATE INDEX IF NOT EXISTS idx_tasks_run_id ON tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_active ON agent_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_configured_agents_owner ON configured_agents(owner_user_id);

-- Insert default system parameters
INSERT INTO system_parameters (parameter_key, parameter_value, parameter_type, description) VALUES
('daily_transaction_limit', '1000000', 'number', 'Default daily transaction limit'),
('monthly_transaction_limit', '10000000', 'number', 'Default monthly transaction limit'),
('minimum_account_balance', '1000', 'number', 'Minimum account balance for savings'),
('interest_rate_savings', '0.025', 'number', 'Default savings account interest rate'),
('aml_threshold_amount', '1000000', 'number', 'AML monitoring threshold amount'),
('session_timeout_minutes', '30', 'number', 'User session timeout in minutes'),
('password_expiry_days', '90', 'number', 'Password expiry period in days'),
('max_login_attempts', '5', 'number', 'Maximum failed login attempts'),
('bank_name', 'Lovable Bank', 'string', 'Bank display name'),
('bank_code', 'LBK', 'string', 'Bank sort code'),
('base_currency', 'NGN', 'string', 'Base currency for operations');

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Customer Account Summary View
CREATE OR REPLACE VIEW customer_account_summary AS
SELECT 
    c.customer_id,
    c.customer_number,
    c.first_name || ' ' || c.last_name AS full_name,
    c.email,
    c.phone_primary,
    c.kyc_status,
    c.customer_tier,
    COUNT(a.account_id) AS total_accounts,
    SUM(CASE WHEN at.type_code = 'SAV' THEN a.available_balance ELSE 0 END) AS total_savings,
    SUM(CASE WHEN at.type_code = 'CUR' THEN a.available_balance ELSE 0 END) AS total_current,
    SUM(a.available_balance) AS total_balance,
    c.created_at AS customer_since
FROM customers c
LEFT JOIN accounts a ON c.customer_id = a.customer_id AND a.status = 'active'
LEFT JOIN account_types at ON a.account_type_id = at.account_type_id
WHERE c.status = 'active'
GROUP BY c.customer_id, c.customer_number, c.first_name, c.last_name, 
         c.email, c.phone_primary, c.kyc_status, c.customer_tier, c.created_at;

-- Daily Transaction Summary View
CREATE OR REPLACE VIEW daily_transaction_summary AS
SELECT 
    t.transaction_date,
    tt.type_name,
    t.channel,
    COUNT(*) AS transaction_count,
    SUM(t.amount) AS total_amount,
    AVG(t.amount) AS average_amount,
    SUM(t.transaction_fee) AS total_fees
FROM transactions t
JOIN transaction_types tt ON t.transaction_type_id = tt.transaction_type_id
WHERE t.status = 'completed'
GROUP BY t.transaction_date, tt.type_name, t.channel
ORDER BY t.transaction_date DESC;

-- Account Balance Summary View
CREATE OR REPLACE VIEW account_balance_summary AS
SELECT 
    at.type_name AS account_type,
    COUNT(a.account_id) AS account_count,
    SUM(a.available_balance) AS total_balance,
    AVG(a.available_balance) AS average_balance,
    SUM(CASE WHEN a.available_balance < 0 THEN a.available_balance ELSE 0 END) AS total_overdrafts
FROM accounts a
JOIN account_types at ON a.account_type_id = at.account_type_id
WHERE a.status = 'active'
GROUP BY at.type_name, at.type_code
ORDER BY at.type_code;