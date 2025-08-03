import { query } from '../../config/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Customer creation schema
export const createCustomerSchema = z.object({
    title: z.string().optional(),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    middle_name: z.string().optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: z.enum(['male', 'female', 'other']),
    marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
    nationality: z.string().default('Nigerian'),
    
    // Identity Information
    bvn: z.string().length(11).optional(),
    nin: z.string().length(11).optional(),
    passport_number: z.string().optional(),
    drivers_license: z.string().optional(),
    
    // Contact Information
    email: z.string().email(),
    phone_primary: z.string().min(10),
    phone_secondary: z.string().optional(),
    
    // Address Information
    address_line1: z.string().min(1),
    address_line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postal_code: z.string().optional(),
    country: z.string().default('Nigeria'),
    
    // Employment Information
    employer_name: z.string().optional(),
    employer_address: z.string().optional(),
    occupation: z.string().optional(),
    employment_status: z.enum(['employed', 'self_employed', 'unemployed', 'retired', 'student']).optional(),
    monthly_income: z.number().positive().optional(),
    
    // Banking Information
    customer_tier: z.enum(['Tier 1', 'Tier 2', 'Tier 3']).default('Tier 1'),
    is_pep: z.boolean().default(false),
    is_staff: z.boolean().default(false)
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// KYC update schema
export const kycUpdateSchema = z.object({
    kyc_status: z.enum(['pending', 'in_progress', 'verified', 'rejected', 'expired']),
    kyc_level: z.number().int().min(1).max(3),
    customer_tier: z.enum(['Tier 1', 'Tier 2', 'Tier 3']),
    risk_rating: z.enum(['low', 'medium', 'high']),
    notes: z.string().optional()
});

// Customer number generation
export const generateCustomerNumber = async (): Promise<string> => {
    // Get bank code from system parameters
    const bankCodeResult = await query(
        'SELECT parameter_value FROM system_parameters WHERE parameter_key = $1',
        ['bank_code']
    );
    const bankCode = bankCodeResult.rows[0]?.parameter_value || 'LBK';
    
    // Generate unique sequence number
    const sequenceResult = await query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(customer_number, 4) AS INTEGER)), 0) + 1 as next_sequence
        FROM customers 
        WHERE customer_number LIKE $1
    `, [`${bankCode}%`]);
    
    const sequence = sequenceResult.rows[0].next_sequence;
    const paddedSequence = sequence.toString().padStart(10, '0');
    
    return `${bankCode}${paddedSequence}`;
};

// Create new customer
export const createCustomer = async (customerData: CreateCustomerInput, createdBy: string): Promise<any> => {
    const client = await query('BEGIN', []);
    
    try {
        // Check for duplicate email
        const emailCheck = await query(
            'SELECT customer_id FROM customers WHERE email = $1',
            [customerData.email]
        );
        
        if (emailCheck.rows.length > 0) {
            throw new Error('Email address already exists');
        }
        
        // Check for duplicate phone
        const phoneCheck = await query(
            'SELECT customer_id FROM customers WHERE phone_primary = $1',
            [customerData.phone_primary]
        );
        
        if (phoneCheck.rows.length > 0) {
            throw new Error('Phone number already exists');
        }
        
        // Check for duplicate BVN if provided
        if (customerData.bvn) {
            const bvnCheck = await query(
                'SELECT customer_id FROM customers WHERE bvn = $1',
                [customerData.bvn]
            );
            
            if (bvnCheck.rows.length > 0) {
                throw new Error('BVN already exists');
            }
        }
        
        // Check for duplicate NIN if provided
        if (customerData.nin) {
            const ninCheck = await query(
                'SELECT customer_id FROM customers WHERE nin = $1',
                [customerData.nin]
            );
            
            if (ninCheck.rows.length > 0) {
                throw new Error('NIN already exists');
            }
        }
        
        // Generate customer number
        const customerNumber = await generateCustomerNumber();
        
        // Create customer
        const customerId = uuidv4();
        const newCustomerResult = await query(`
            INSERT INTO customers (
                customer_id, customer_number, title, first_name, last_name, middle_name,
                date_of_birth, gender, marital_status, nationality,
                bvn, nin, passport_number, drivers_license,
                email, phone_primary, phone_secondary,
                address_line1, address_line2, city, state, postal_code, country,
                employer_name, employer_address, occupation, employment_status, monthly_income,
                customer_tier, is_pep, is_staff, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
            ) RETURNING *
        `, [
            customerId,
            customerNumber,
            customerData.title,
            customerData.first_name,
            customerData.last_name,
            customerData.middle_name,
            customerData.date_of_birth,
            customerData.gender,
            customerData.marital_status,
            customerData.nationality,
            customerData.bvn,
            customerData.nin,
            customerData.passport_number,
            customerData.drivers_license,
            customerData.email,
            customerData.phone_primary,
            customerData.phone_secondary,
            customerData.address_line1,
            customerData.address_line2,
            customerData.city,
            customerData.state,
            customerData.postal_code,
            customerData.country,
            customerData.employer_name,
            customerData.employer_address,
            customerData.occupation,
            customerData.employment_status,
            customerData.monthly_income,
            customerData.customer_tier,
            customerData.is_pep,
            customerData.is_staff,
            createdBy
        ]);
        
        await query('COMMIT', []);
        return newCustomerResult.rows[0];
        
    } catch (error) {
        await query('ROLLBACK', []);
        throw error;
    }
};

// Get customer by ID
export const getCustomerById = async (customerId: string) => {
    const result = await query(`
        SELECT * FROM customers WHERE customer_id = $1
    `, [customerId]);
    
    return result.rows[0] || null;
};

// Get customer by customer number
export const getCustomerByNumber = async (customerNumber: string) => {
    const result = await query(`
        SELECT * FROM customers WHERE customer_number = $1
    `, [customerNumber]);
    
    return result.rows[0] || null;
};

// Get customer by email
export const getCustomerByEmail = async (email: string) => {
    const result = await query(`
        SELECT * FROM customers WHERE email = $1
    `, [email]);
    
    return result.rows[0] || null;
};

// Get customer by BVN
export const getCustomerByBVN = async (bvn: string) => {
    const result = await query(`
        SELECT * FROM customers WHERE bvn = $1
    `, [bvn]);
    
    return result.rows[0] || null;
};

// Search customers
export const searchCustomers = async (options: {
    search?: string;
    kyc_status?: string;
    customer_tier?: string;
    status?: string;
    limit?: number;
    offset?: number;
}) => {
    let whereConditions = ['1=1'];
    let queryParams: any[] = [];
    let paramIndex = 1;
    
    if (options.search) {
        whereConditions.push(`(
            first_name ILIKE $${paramIndex} OR 
            last_name ILIKE $${paramIndex} OR 
            email ILIKE $${paramIndex} OR 
            phone_primary ILIKE $${paramIndex} OR
            customer_number ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${options.search}%`);
        paramIndex++;
    }
    
    if (options.kyc_status) {
        whereConditions.push(`kyc_status = $${paramIndex}`);
        queryParams.push(options.kyc_status);
        paramIndex++;
    }
    
    if (options.customer_tier) {
        whereConditions.push(`customer_tier = $${paramIndex}`);
        queryParams.push(options.customer_tier);
        paramIndex++;
    }
    
    if (options.status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(options.status);
        paramIndex++;
    }
    
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const result = await query(`
        SELECT 
            customer_id, customer_number, first_name, last_name, email, phone_primary,
            kyc_status, customer_tier, status, created_at
        FROM customers
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);
    
    return result.rows;
};

// Update customer KYC status
export const updateCustomerKYC = async (
    customerId: string, 
    kycData: z.infer<typeof kycUpdateSchema>,
    updatedBy: string
) => {
    const result = await query(`
        UPDATE customers 
        SET kyc_status = $1, kyc_level = $2, customer_tier = $3, risk_rating = $4
        WHERE customer_id = $5
        RETURNING *
    `, [
        kycData.kyc_status,
        kycData.kyc_level,
        kycData.customer_tier,
        kycData.risk_rating,
        customerId
    ]);
    
    if (result.rows.length === 0) {
        throw new Error('Customer not found');
    }
    
    // Log the KYC update
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, [
        'customers', 
        customerId, 
        'UPDATE', 
        JSON.stringify({
            kyc_status: kycData.kyc_status,
            kyc_level: kycData.kyc_level,
            customer_tier: kycData.customer_tier,
            risk_rating: kycData.risk_rating,
            notes: kycData.notes
        }), 
        updatedBy
    ]);
    
    return result.rows[0];
};

// Suspend customer
export const suspendCustomer = async (customerId: string, reason: string, suspendedBy: string) => {
    const result = await query(
        'UPDATE customers SET status = $1, blacklisted = $2, blacklist_reason = $3 WHERE customer_id = $4 RETURNING *',
        ['suspended', true, reason, customerId]
    );
    
    if (result.rows.length === 0) {
        throw new Error('Customer not found');
    }
    
    // Log the suspension
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, ['customers', customerId, 'UPDATE', JSON.stringify({ status: 'suspended', reason }), suspendedBy]);
    
    return result.rows[0];
};

// Reactivate customer
export const reactivateCustomer = async (customerId: string, reactivatedBy: string) => {
    const result = await query(
        'UPDATE customers SET status = $1, blacklisted = $2, blacklist_reason = $3 WHERE customer_id = $4 RETURNING *',
        ['active', false, null, customerId]
    );
    
    if (result.rows.length === 0) {
        throw new Error('Customer not found');
    }
    
    // Log the reactivation
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, ['customers', customerId, 'UPDATE', JSON.stringify({ status: 'active' }), reactivatedBy]);
    
    return result.rows[0];
};

// Update customer information
export const updateCustomer = async (
    customerId: string, 
    updateData: Partial<CreateCustomerInput>,
    updatedBy: string
) => {
    const customer = await getCustomerById(customerId);
    if (!customer) {
        throw new Error('Customer not found');
    }
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && value !== null) {
            updateFields.push(`${key} = $${paramIndex}`);
            updateValues.push(value);
            paramIndex++;
        }
    }
    
    if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
    }
    
    updateValues.push(customerId);
    
    const result = await query(`
        UPDATE customers 
        SET ${updateFields.join(', ')}
        WHERE customer_id = $${paramIndex}
        RETURNING *
    `, updateValues);
    
    // Log the update
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, ['customers', customerId, 'UPDATE', JSON.stringify(updateData), updatedBy]);
    
    return result.rows[0];
};

// Get customer summary (with accounts, transactions, etc.)
export const getCustomerSummary = async (customerId: string) => {
    const customer = await getCustomerById(customerId);
    if (!customer) {
        throw new Error('Customer not found');
    }
    
    // Get customer accounts
    const accountsResult = await query(`
        SELECT 
            a.account_id, a.account_number, a.account_name, a.available_balance,
            at.type_name as account_type, a.status
        FROM accounts a
        JOIN account_types at ON a.account_type_id = at.account_type_id
        WHERE a.customer_id = $1
        ORDER BY a.created_at DESC
    `, [customerId]);
    
    // Get recent transactions (last 10)
    const transactionsResult = await query(`
        SELECT 
            t.transaction_id, t.reference_number, t.amount, t.description,
            t.transaction_date, t.status, tt.type_name, a.account_number
        FROM transactions t
        JOIN transaction_types tt ON t.transaction_type_id = tt.transaction_type_id
        JOIN accounts a ON t.account_id = a.account_id
        WHERE a.customer_id = $1
        ORDER BY t.created_at DESC
        LIMIT 10
    `, [customerId]);
    
    // Calculate totals
    const totalBalance = accountsResult.rows.reduce((sum, account) => 
        sum + parseFloat(account.available_balance), 0
    );
    
    return {
        customer,
        accounts: accountsResult.rows,
        recent_transactions: transactionsResult.rows,
        summary: {
            total_accounts: accountsResult.rows.length,
            total_balance: totalBalance,
            active_accounts: accountsResult.rows.filter(a => a.status === 'active').length
        }
    };
};

// BVN verification simulation (in real implementation, this would call BVN API)
export const verifyBVN = async (bvn: string, customerData: any) => {
    // Simulate BVN verification
    // In real implementation, this would call external BVN verification service
    
    if (bvn.length !== 11) {
        return {
            verified: false,
            message: 'Invalid BVN format'
        };
    }
    
    // Simulate verification success
    return {
        verified: true,
        message: 'BVN verified successfully',
        bvn_data: {
            first_name: customerData.first_name,
            last_name: customerData.last_name,
            date_of_birth: customerData.date_of_birth,
            phone_number: customerData.phone_primary
        }
    };
};