import { query } from '../../config/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Account creation schema
export const createAccountSchema = z.object({
    customer_id: z.string().uuid(),
    account_type_code: z.string(),
    account_name: z.string().min(1),
    initial_deposit: z.number().min(0).default(0),
    currency: z.string().length(3).default('NGN'),
    branch_code: z.string().optional(),
    account_officer_id: z.string().uuid().optional(),
    overdraft_limit: z.number().min(0).default(0),
    daily_transaction_limit: z.number().min(0).optional(),
    monthly_transaction_limit: z.number().min(0).optional(),
    requires_two_signatures: z.boolean().default(false),
    sms_alerts_enabled: z.boolean().default(true),
    email_alerts_enabled: z.boolean().default(true)
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

// Account number generation service
export const generateAccountNumber = async (accountTypeCode: string): Promise<string> => {
    // Get bank code from system parameters
    const bankCodeResult = await query(
        'SELECT parameter_value FROM system_parameters WHERE parameter_key = $1',
        ['bank_code']
    );
    const bankCode = bankCodeResult.rows[0]?.parameter_value || 'LBK';
    
    // Get account type prefix
    const typePrefix = {
        'SAV': '10',
        'CUR': '20', 
        'FD': '30',
        'LOAN': '40'
    }[accountTypeCode] || '00';
    
    // Generate unique sequence number
    const sequenceResult = await query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(account_number, 7) AS INTEGER)), 0) + 1 as next_sequence
        FROM accounts 
        WHERE account_number LIKE $1
    `, [`${bankCode}${typePrefix}%`]);
    
    const sequence = sequenceResult.rows[0].next_sequence;
    const paddedSequence = sequence.toString().padStart(8, '0');
    
    return `${bankCode}${typePrefix}${paddedSequence}`;
};

// Create new account
export const createAccount = async (accountData: CreateAccountInput): Promise<any> => {
    const client = await query('BEGIN', []);
    
    try {
        // Validate customer exists and is active
        const customerResult = await query(
            'SELECT customer_id, status, kyc_status FROM customers WHERE customer_id = $1',
            [accountData.customer_id]
        );
        
        if (customerResult.rows.length === 0) {
            throw new Error('Customer not found');
        }
        
        const customer = customerResult.rows[0];
        if (customer.status !== 'active') {
            throw new Error('Customer account is not active');
        }
        
        if (customer.kyc_status !== 'verified') {
            throw new Error('Customer KYC verification required');
        }
        
        // Get account type details
        const accountTypeResult = await query(
            'SELECT * FROM account_types WHERE type_code = $1 AND is_active = true',
            [accountData.account_type_code]
        );
        
        if (accountTypeResult.rows.length === 0) {
            throw new Error('Invalid or inactive account type');
        }
        
        const accountType = accountTypeResult.rows[0];
        
        // Validate minimum balance requirement
        if (accountData.initial_deposit < accountType.minimum_balance) {
            throw new Error(`Minimum initial deposit is ${accountType.minimum_balance}`);
        }
        
        // Generate account number
        const accountNumber = await generateAccountNumber(accountData.account_type_code);
        
        // Create account
        const accountId = uuidv4();
        const newAccountResult = await query(`
            INSERT INTO accounts (
                account_id, account_number, customer_id, account_type_id, account_name,
                available_balance, book_balance, currency, interest_rate,
                overdraft_limit, daily_transaction_limit, monthly_transaction_limit,
                branch_code, account_officer_id, requires_two_signatures,
                sms_alerts_enabled, email_alerts_enabled, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            ) RETURNING *
        `, [
            accountId,
            accountNumber,
            accountData.customer_id,
            accountType.account_type_id,
            accountData.account_name,
            accountData.initial_deposit,
            accountData.initial_deposit,
            accountData.currency,
            accountType.interest_rate,
            accountData.overdraft_limit,
            accountData.daily_transaction_limit || accountType.transaction_limit_daily,
            accountData.monthly_transaction_limit || accountType.transaction_limit_monthly,
            accountData.branch_code,
            accountData.account_officer_id,
            accountData.requires_two_signatures,
            accountData.sms_alerts_enabled,
            accountData.email_alerts_enabled,
            'active'
        ]);
        
        // Create initial deposit transaction if amount > 0
        if (accountData.initial_deposit > 0) {
            await createTransaction({
                account_id: accountId,
                transaction_type_code: 'DEP',
                amount: accountData.initial_deposit,
                description: 'Initial deposit on account opening',
                channel: 'branch',
                reference_number: `DEP${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
            });
        }
        
        await query('COMMIT', []);
        return newAccountResult.rows[0];
        
    } catch (error) {
        await query('ROLLBACK', []);
        throw error;
    }
};

// Get account by ID with full details
export const getAccountById = async (accountId: string) => {
    const result = await query(`
        SELECT 
            a.*,
            at.type_name as account_type_name,
            at.type_code as account_type_code,
            c.first_name || ' ' || c.last_name as customer_name,
            c.customer_number,
            c.email as customer_email,
            c.phone_primary as customer_phone
        FROM accounts a
        JOIN account_types at ON a.account_type_id = at.account_type_id
        JOIN customers c ON a.customer_id = c.customer_id
        WHERE a.account_id = $1
    `, [accountId]);
    
    return result.rows[0] || null;
};

// Get account by account number
export const getAccountByNumber = async (accountNumber: string) => {
    const result = await query(`
        SELECT 
            a.*,
            at.type_name as account_type_name,
            at.type_code as account_type_code,
            c.first_name || ' ' || c.last_name as customer_name,
            c.customer_number,
            c.email as customer_email,
            c.phone_primary as customer_phone
        FROM accounts a
        JOIN account_types at ON a.account_type_id = at.account_type_id
        JOIN customers c ON a.customer_id = c.customer_id
        WHERE a.account_number = $1
    `, [accountNumber]);
    
    return result.rows[0] || null;
};

// Get customer accounts
export const getCustomerAccounts = async (customerId: string) => {
    const result = await query(`
        SELECT 
            a.*,
            at.type_name as account_type_name,
            at.type_code as account_type_code
        FROM accounts a
        JOIN account_types at ON a.account_type_id = at.account_type_id
        WHERE a.customer_id = $1 AND a.status != 'closed'
        ORDER BY a.created_at DESC
    `, [customerId]);
    
    return result.rows;
};

// Update account balance (internal function)
export const updateAccountBalance = async (
    accountId: string, 
    amount: number, 
    isDebit: boolean = false
): Promise<{ old_balance: number; new_balance: number }> => {
    const account = await getAccountById(accountId);
    if (!account) {
        throw new Error('Account not found');
    }
    
    if (account.status !== 'active') {
        throw new Error('Account is not active');
    }
    
    const oldBalance = parseFloat(account.available_balance);
    const newBalance = isDebit ? oldBalance - amount : oldBalance + amount;
    
    // Check for sufficient funds (considering overdraft)
    if (newBalance < -parseFloat(account.overdraft_limit)) {
        throw new Error('Insufficient funds');
    }
    
    await query(
        'UPDATE accounts SET available_balance = $1, book_balance = $2, last_transaction_date = CURRENT_DATE WHERE account_id = $3',
        [newBalance, newBalance, accountId]
    );
    
    return { old_balance: oldBalance, new_balance: newBalance };
};

// Create transaction
export const createTransaction = async (transactionData: {
    account_id: string;
    transaction_type_code: string;
    amount: number;
    description: string;
    channel: string;
    reference_number: string;
    beneficiary_account_number?: string;
    beneficiary_name?: string;
    beneficiary_bank_code?: string;
    originator_account_number?: string;
    originator_name?: string;
    originator_bank_code?: string;
    initiated_by?: string;
    device_info?: any;
    location?: string;
}) => {
    const client = await query('BEGIN', []);
    
    try {
        // Get transaction type
        const transactionTypeResult = await query(
            'SELECT * FROM transaction_types WHERE type_code = $1 AND is_active = true',
            [transactionData.transaction_type_code]
        );
        
        if (transactionTypeResult.rows.length === 0) {
            throw new Error('Invalid transaction type');
        }
        
        const transactionType = transactionTypeResult.rows[0];
        
        // Get current account balance
        const account = await getAccountById(transactionData.account_id);
        if (!account) {
            throw new Error('Account not found');
        }
        
        const balanceBefore = parseFloat(account.available_balance);
        
        // Calculate transaction fee
        const transactionFee = parseFloat(transactionType.transaction_fee) || 0;
        const totalAmount = transactionData.amount + transactionFee;
        
        // Update account balance
        const balanceUpdate = await updateAccountBalance(
            transactionData.account_id,
            totalAmount,
            transactionType.is_debit
        );
        
        // Create transaction record
        const transactionId = uuidv4();
        const transactionResult = await query(`
            INSERT INTO transactions (
                transaction_id, reference_number, account_id, transaction_type_id,
                amount, transaction_fee, balance_before, balance_after,
                description, channel, location, device_info,
                beneficiary_account_number, beneficiary_name, beneficiary_bank_code,
                originator_account_number, originator_name, originator_bank_code,
                status, initiated_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) RETURNING *
        `, [
            transactionId,
            transactionData.reference_number,
            transactionData.account_id,
            transactionType.transaction_type_id,
            transactionData.amount,
            transactionFee,
            balanceBefore,
            balanceUpdate.new_balance,
            transactionData.description,
            transactionData.channel,
            transactionData.location,
            transactionData.device_info ? JSON.stringify(transactionData.device_info) : null,
            transactionData.beneficiary_account_number,
            transactionData.beneficiary_name,
            transactionData.beneficiary_bank_code,
            transactionData.originator_account_number,
            transactionData.originator_name,
            transactionData.originator_bank_code,
            'completed',
            transactionData.initiated_by
        ]);
        
        await query('COMMIT', []);
        return transactionResult.rows[0];
        
    } catch (error) {
        await query('ROLLBACK', []);
        throw error;
    }
};

// Transfer between accounts
export const transferFunds = async (transferData: {
    from_account_id: string;
    to_account_number: string;
    amount: number;
    description: string;
    channel: string;
    initiated_by: string;
    device_info?: any;
    location?: string;
}) => {
    const client = await query('BEGIN', []);
    
    try {
        // Validate source account
        const fromAccount = await getAccountById(transferData.from_account_id);
        if (!fromAccount || fromAccount.status !== 'active') {
            throw new Error('Source account not found or inactive');
        }
        
        // Validate destination account
        const toAccount = await getAccountByNumber(transferData.to_account_number);
        if (!toAccount || toAccount.status !== 'active') {
            throw new Error('Destination account not found or inactive');
        }
        
        if (fromAccount.account_id === toAccount.account_id) {
            throw new Error('Cannot transfer to the same account');
        }
        
        // Check daily transaction limit
        const dailyTransactionsResult = await query(`
            SELECT COALESCE(SUM(amount), 0) as daily_total
            FROM transactions t
            JOIN transaction_types tt ON t.transaction_type_id = tt.transaction_type_id
            WHERE t.account_id = $1 
            AND tt.is_debit = true 
            AND t.transaction_date = CURRENT_DATE 
            AND t.status = 'completed'
        `, [transferData.from_account_id]);
        
        const dailyTotal = parseFloat(dailyTransactionsResult.rows[0].daily_total);
        const dailyLimit = parseFloat(fromAccount.daily_transaction_limit);
        
        if (dailyTotal + transferData.amount > dailyLimit) {
            throw new Error('Daily transaction limit exceeded');
        }
        
        // Generate reference numbers
        const debitRef = `TRF${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const creditRef = `TRF${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        // Create debit transaction
        const debitTransaction = await createTransaction({
            account_id: transferData.from_account_id,
            transaction_type_code: 'TRF_OUT',
            amount: transferData.amount,
            description: `Transfer to ${toAccount.customer_name} (${transferData.to_account_number})`,
            channel: transferData.channel,
            reference_number: debitRef,
            beneficiary_account_number: transferData.to_account_number,
            beneficiary_name: toAccount.customer_name,
            initiated_by: transferData.initiated_by,
            device_info: transferData.device_info,
            location: transferData.location
        });
        
        // Create credit transaction
        const creditTransaction = await createTransaction({
            account_id: toAccount.account_id,
            transaction_type_code: 'TRF_IN',
            amount: transferData.amount,
            description: `Transfer from ${fromAccount.customer_name} (${fromAccount.account_number})`,
            channel: transferData.channel,
            reference_number: creditRef,
            originator_account_number: fromAccount.account_number,
            originator_name: fromAccount.customer_name,
            initiated_by: transferData.initiated_by,
            device_info: transferData.device_info,
            location: transferData.location
        });
        
        await query('COMMIT', []);
        
        return {
            debit_transaction: debitTransaction,
            credit_transaction: creditTransaction,
            transfer_reference: debitRef
        };
        
    } catch (error) {
        await query('ROLLBACK', []);
        throw error;
    }
};

// Get account transaction history
export const getAccountTransactions = async (
    accountId: string, 
    options: {
        limit?: number;
        offset?: number;
        startDate?: string;
        endDate?: string;
        transactionType?: string;
        channel?: string;
    } = {}
) => {
    let whereConditions = ['t.account_id = $1'];
    let queryParams: any[] = [accountId];
    let paramIndex = 2;
    
    if (options.startDate) {
        whereConditions.push(`t.transaction_date >= $${paramIndex}`);
        queryParams.push(options.startDate);
        paramIndex++;
    }
    
    if (options.endDate) {
        whereConditions.push(`t.transaction_date <= $${paramIndex}`);
        queryParams.push(options.endDate);
        paramIndex++;
    }
    
    if (options.transactionType) {
        whereConditions.push(`tt.type_code = $${paramIndex}`);
        queryParams.push(options.transactionType);
        paramIndex++;
    }
    
    if (options.channel) {
        whereConditions.push(`t.channel = $${paramIndex}`);
        queryParams.push(options.channel);
        paramIndex++;
    }
    
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const result = await query(`
        SELECT 
            t.*,
            tt.type_name,
            tt.is_debit
        FROM transactions t
        JOIN transaction_types tt ON t.transaction_type_id = tt.transaction_type_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);
    
    return result.rows;
};

// Freeze/Unfreeze account
export const freezeAccount = async (accountId: string, reason: string, userId: string) => {
    const result = await query(
        'UPDATE accounts SET status = $1 WHERE account_id = $2 AND status = $3 RETURNING *',
        ['frozen', accountId, 'active']
    );
    
    if (result.rows.length === 0) {
        throw new Error('Account not found or cannot be frozen');
    }
    
    // Log the action
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, ['accounts', accountId, 'UPDATE', JSON.stringify({ status: 'frozen', reason }), userId]);
    
    return result.rows[0];
};

export const unfreezeAccount = async (accountId: string, userId: string) => {
    const result = await query(
        'UPDATE accounts SET status = $1 WHERE account_id = $2 AND status = $3 RETURNING *',
        ['active', accountId, 'frozen']
    );
    
    if (result.rows.length === 0) {
        throw new Error('Account not found or not frozen');
    }
    
    // Log the action
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, ['accounts', accountId, 'UPDATE', JSON.stringify({ status: 'active' }), userId]);
    
    return result.rows[0];
};

// Close account
export const closeAccount = async (accountId: string, reason: string, userId: string) => {
    const account = await getAccountById(accountId);
    if (!account) {
        throw new Error('Account not found');
    }
    
    if (parseFloat(account.available_balance) !== 0) {
        throw new Error('Account must have zero balance before closing');
    }
    
    const result = await query(
        'UPDATE accounts SET status = $1, date_closed = CURRENT_DATE WHERE account_id = $2 RETURNING *',
        ['closed', accountId]
    );
    
    // Log the action
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, ['accounts', accountId, 'UPDATE', JSON.stringify({ status: 'closed', reason }), userId]);
    
    return result.rows[0];
};

// Account statement generation
export const generateAccountStatement = async (
    accountId: string,
    startDate: string,
    endDate: string
) => {
    const account = await getAccountById(accountId);
    if (!account) {
        throw new Error('Account not found');
    }
    
    const transactions = await getAccountTransactions(accountId, {
        startDate,
        endDate,
        limit: 1000
    });
    
    // Calculate opening balance
    const openingBalanceResult = await query(`
        SELECT COALESCE(balance_after, 0) as opening_balance
        FROM transactions 
        WHERE account_id = $1 AND transaction_date < $2
        ORDER BY created_at DESC
        LIMIT 1
    `, [accountId, startDate]);
    
    const openingBalance = openingBalanceResult.rows[0]?.opening_balance || 0;
    
    // Calculate totals
    const totals = transactions.reduce((acc, txn) => {
        if (txn.is_debit) {
            acc.totalDebits += parseFloat(txn.amount);
        } else {
            acc.totalCredits += parseFloat(txn.amount);
        }
        return acc;
    }, { totalDebits: 0, totalCredits: 0 });
    
    const closingBalance = parseFloat(openingBalance) + totals.totalCredits - totals.totalDebits;
    
    return {
        account: {
            account_number: account.account_number,
            account_name: account.account_name,
            customer_name: account.customer_name,
            account_type: account.account_type_name
        },
        period: { startDate, endDate },
        balances: {
            opening: parseFloat(openingBalance),
            closing: closingBalance
        },
        totals,
        transactions: transactions.map(txn => ({
            date: txn.transaction_date,
            description: txn.description,
            reference: txn.reference_number,
            debit: txn.is_debit ? parseFloat(txn.amount) : null,
            credit: !txn.is_debit ? parseFloat(txn.amount) : null,
            balance: parseFloat(txn.balance_after)
        }))
    };
};