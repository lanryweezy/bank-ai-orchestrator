import { query } from '../../config/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// AML Alert schema
export const createAMLAlertSchema = z.object({
    transaction_id: z.string().uuid().optional(),
    customer_id: z.string().uuid(),
    alert_type: z.enum(['high_value', 'suspicious_pattern', 'velocity', 'sanctions_match', 'pep_transaction', 'cash_threshold']),
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    description: z.string().min(1),
    alert_data: z.any().optional()
});

export type CreateAMLAlertInput = z.infer<typeof createAMLAlertSchema>;

// Transaction monitoring thresholds
const AML_THRESHOLDS = {
    HIGH_VALUE_THRESHOLD: 1000000, // 1M NGN
    CASH_THRESHOLD: 500000, // 500K NGN
    DAILY_VELOCITY_THRESHOLD: 2000000, // 2M NGN per day
    MONTHLY_VELOCITY_THRESHOLD: 10000000, // 10M NGN per month
    SUSPICIOUS_PATTERN_COUNT: 5 // 5 transactions in short time
};

// Create AML Alert
export const createAMLAlert = async (alertData: CreateAMLAlertInput): Promise<any> => {
    const alertId = uuidv4();
    
    const result = await query(`
        INSERT INTO aml_alerts (
            alert_id, transaction_id, customer_id, alert_type, 
            severity, description, alert_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [
        alertId,
        alertData.transaction_id,
        alertData.customer_id,
        alertData.alert_type,
        alertData.severity,
        alertData.description,
        alertData.alert_data ? JSON.stringify(alertData.alert_data) : null
    ]);
    
    return result.rows[0];
};

// Monitor transaction for AML compliance
export const monitorTransaction = async (transaction: any): Promise<void> => {
    const customerId = transaction.customer_id;
    const amount = parseFloat(transaction.amount);
    const transactionId = transaction.transaction_id;
    
    // Check high value threshold
    if (amount >= AML_THRESHOLDS.HIGH_VALUE_THRESHOLD) {
        await createAMLAlert({
            transaction_id: transactionId,
            customer_id: customerId,
            alert_type: 'high_value',
            severity: 'high',
            description: `High value transaction of ${amount} detected`,
            alert_data: {
                amount,
                threshold: AML_THRESHOLDS.HIGH_VALUE_THRESHOLD,
                channel: transaction.channel
            }
        });
    }
    
    // Check cash threshold for cash transactions
    if (transaction.channel === 'branch' && amount >= AML_THRESHOLDS.CASH_THRESHOLD) {
        await createAMLAlert({
            transaction_id: transactionId,
            customer_id: customerId,
            alert_type: 'cash_threshold',
            severity: 'medium',
            description: `Cash transaction exceeding threshold: ${amount}`,
            alert_data: {
                amount,
                threshold: AML_THRESHOLDS.CASH_THRESHOLD,
                channel: transaction.channel
            }
        });
    }
    
    // Check velocity (daily)
    const dailyTransactionsResult = await query(`
        SELECT COALESCE(SUM(t.amount), 0) as daily_total, COUNT(*) as transaction_count
        FROM transactions t
        JOIN accounts a ON t.account_id = a.account_id
        WHERE a.customer_id = $1 
        AND t.transaction_date = CURRENT_DATE
        AND t.status = 'completed'
    `, [customerId]);
    
    const dailyTotal = parseFloat(dailyTransactionsResult.rows[0].daily_total);
    const dailyCount = parseInt(dailyTransactionsResult.rows[0].transaction_count);
    
    if (dailyTotal >= AML_THRESHOLDS.DAILY_VELOCITY_THRESHOLD) {
        await createAMLAlert({
            transaction_id: transactionId,
            customer_id: customerId,
            alert_type: 'velocity',
            severity: 'high',
            description: `Daily transaction velocity exceeded: ${dailyTotal}`,
            alert_data: {
                daily_total: dailyTotal,
                transaction_count: dailyCount,
                threshold: AML_THRESHOLDS.DAILY_VELOCITY_THRESHOLD
            }
        });
    }
    
    // Check suspicious pattern (multiple transactions in short time)
    if (dailyCount >= AML_THRESHOLDS.SUSPICIOUS_PATTERN_COUNT) {
        await createAMLAlert({
            transaction_id: transactionId,
            customer_id: customerId,
            alert_type: 'suspicious_pattern',
            severity: 'medium',
            description: `Suspicious transaction pattern: ${dailyCount} transactions today`,
            alert_data: {
                transaction_count: dailyCount,
                threshold: AML_THRESHOLDS.SUSPICIOUS_PATTERN_COUNT,
                pattern_type: 'high_frequency'
            }
        });
    }
    
    // Check for PEP transactions
    const customerResult = await query(
        'SELECT is_pep FROM customers WHERE customer_id = $1',
        [customerId]
    );
    
    if (customerResult.rows[0]?.is_pep && amount >= 100000) {
        await createAMLAlert({
            transaction_id: transactionId,
            customer_id: customerId,
            alert_type: 'pep_transaction',
            severity: 'high',
            description: `PEP transaction detected: ${amount}`,
            alert_data: {
                amount,
                pep_status: true,
                channel: transaction.channel
            }
        });
    }
};

// Screen customer against sanctions lists
export const screenCustomer = async (customerId: string): Promise<any> => {
    const customer = await query(
        'SELECT first_name, last_name, date_of_birth FROM customers WHERE customer_id = $1',
        [customerId]
    );
    
    if (customer.rows.length === 0) {
        throw new Error('Customer not found');
    }
    
    const customerData = customer.rows[0];
    const fullName = `${customerData.first_name} ${customerData.last_name}`.toLowerCase();
    
    // Screen against sanctions lists
    const sanctionsResult = await query(`
        SELECT se.*, sl.list_name, sl.source
        FROM sanctioned_entities se
        JOIN sanctions_lists sl ON se.list_id = sl.list_id
        WHERE sl.is_active = true
        AND (
            LOWER(se.primary_name) LIKE $1 OR
            EXISTS (
                SELECT 1 FROM unnest(se.aliases) AS alias 
                WHERE LOWER(alias) LIKE $1
            )
        )
    `, [`%${fullName}%`]);
    
    const matches = sanctionsResult.rows;
    
    if (matches.length > 0) {
        // Create sanctions alert
        await createAMLAlert({
            customer_id: customerId,
            alert_type: 'sanctions_match',
            severity: 'critical',
            description: `Potential sanctions match found for customer`,
            alert_data: {
                customer_name: fullName,
                matches: matches.map(match => ({
                    sanctioned_name: match.primary_name,
                    list_name: match.list_name,
                    source: match.source,
                    match_score: calculateMatchScore(fullName, match.primary_name)
                }))
            }
        });
    }
    
    return {
        customer_id: customerId,
        screening_date: new Date().toISOString(),
        matches_found: matches.length,
        matches: matches,
        status: matches.length > 0 ? 'potential_match' : 'clear'
    };
};

// Calculate simple match score for sanctions screening
const calculateMatchScore = (name1: string, name2: string): number => {
    const similarity = name1.toLowerCase() === name2.toLowerCase() ? 100 : 
                      name1.toLowerCase().includes(name2.toLowerCase()) ? 80 : 50;
    return similarity;
};

// Get AML alerts with filtering
export const getAMLAlerts = async (options: {
    status?: string;
    severity?: string;
    alert_type?: string;
    customer_id?: string;
    assigned_to?: string;
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
}) => {
    let whereConditions = ['1=1'];
    let queryParams: any[] = [];
    let paramIndex = 1;
    
    if (options.status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(options.status);
        paramIndex++;
    }
    
    if (options.severity) {
        whereConditions.push(`severity = $${paramIndex}`);
        queryParams.push(options.severity);
        paramIndex++;
    }
    
    if (options.alert_type) {
        whereConditions.push(`alert_type = $${paramIndex}`);
        queryParams.push(options.alert_type);
        paramIndex++;
    }
    
    if (options.customer_id) {
        whereConditions.push(`customer_id = $${paramIndex}`);
        queryParams.push(options.customer_id);
        paramIndex++;
    }
    
    if (options.assigned_to) {
        whereConditions.push(`assigned_to = $${paramIndex}`);
        queryParams.push(options.assigned_to);
        paramIndex++;
    }
    
    if (options.start_date) {
        whereConditions.push(`alert_date >= $${paramIndex}`);
        queryParams.push(options.start_date);
        paramIndex++;
    }
    
    if (options.end_date) {
        whereConditions.push(`alert_date <= $${paramIndex}`);
        queryParams.push(options.end_date);
        paramIndex++;
    }
    
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const result = await query(`
        SELECT 
            a.*,
            c.first_name || ' ' || c.last_name as customer_name,
            c.customer_number,
            t.reference_number as transaction_reference
        FROM aml_alerts a
        JOIN customers c ON a.customer_id = c.customer_id
        LEFT JOIN transactions t ON a.transaction_id = t.transaction_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY a.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);
    
    return result.rows;
};

// Update AML alert status
export const updateAMLAlertStatus = async (
    alertId: string,
    status: 'open' | 'investigating' | 'closed' | 'escalated' | 'false_positive',
    assignedTo?: string,
    notes?: string,
    updatedBy?: string
) => {
    const updateFields = ['status = $2'];
    const updateValues = [alertId, status];
    let paramIndex = 3;
    
    if (assignedTo) {
        updateFields.push(`assigned_to = $${paramIndex}`);
        updateValues.push(assignedTo);
        paramIndex++;
    }
    
    if (notes) {
        updateFields.push(`investigation_notes = $${paramIndex}`);
        updateValues.push(notes);
        paramIndex++;
    }
    
    if (status === 'closed') {
        updateFields.push(`closed_date = CURRENT_DATE`);
    }
    
    const result = await query(`
        UPDATE aml_alerts 
        SET ${updateFields.join(', ')}
        WHERE alert_id = $1
        RETURNING *
    `, updateValues);
    
    if (result.rows.length === 0) {
        throw new Error('AML alert not found');
    }
    
    // Log the update
    if (updatedBy) {
        await query(`
            INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            'aml_alerts', 
            alertId, 
            'UPDATE', 
            JSON.stringify({ status, assigned_to: assignedTo, notes }), 
            updatedBy
        ]);
    }
    
    return result.rows[0];
};

// File SAR (Suspicious Activity Report)
export const fileSAR = async (
    alertId: string,
    sarReference: string,
    filedBy: string
) => {
    const result = await query(`
        UPDATE aml_alerts 
        SET sar_filed = true, sar_reference = $2, sar_filed_date = CURRENT_DATE
        WHERE alert_id = $1
        RETURNING *
    `, [alertId, sarReference]);
    
    if (result.rows.length === 0) {
        throw new Error('AML alert not found');
    }
    
    // Log the SAR filing
    await query(`
        INSERT INTO audit_log (table_name, record_id, operation, new_values, user_id)
        VALUES ($1, $2, $3, $4, $5)
    `, [
        'aml_alerts', 
        alertId, 
        'UPDATE', 
        JSON.stringify({ sar_filed: true, sar_reference: sarReference }), 
        filedBy
    ]);
    
    return result.rows[0];
};

// Get compliance dashboard statistics
export const getComplianceDashboard = async () => {
    // Get alert statistics
    const alertStatsResult = await query(`
        SELECT 
            status,
            severity,
            COUNT(*) as count
        FROM aml_alerts
        WHERE alert_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY status, severity
        ORDER BY status, severity
    `);
    
    // Get alert trends (last 7 days)
    const alertTrendsResult = await query(`
        SELECT 
            DATE(created_at) as alert_date,
            alert_type,
            COUNT(*) as count
        FROM aml_alerts
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at), alert_type
        ORDER BY alert_date DESC
    `);
    
    // Get high-risk customers
    const highRiskCustomersResult = await query(`
        SELECT 
            c.customer_id,
            c.customer_number,
            c.first_name || ' ' || c.last_name as customer_name,
            c.risk_rating,
            COUNT(a.alert_id) as alert_count
        FROM customers c
        LEFT JOIN aml_alerts a ON c.customer_id = a.customer_id AND a.created_at >= CURRENT_DATE - INTERVAL '30 days'
        WHERE c.risk_rating = 'high' OR c.is_pep = true
        GROUP BY c.customer_id, c.customer_number, c.first_name, c.last_name, c.risk_rating
        ORDER BY alert_count DESC, c.risk_rating DESC
        LIMIT 10
    `);
    
    // Get SAR statistics
    const sarStatsResult = await query(`
        SELECT 
            COUNT(CASE WHEN sar_filed = true THEN 1 END) as sars_filed,
            COUNT(CASE WHEN sar_filed = false AND status = 'investigating' THEN 1 END) as pending_sars,
            COUNT(*) as total_alerts
        FROM aml_alerts
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    
    return {
        alert_statistics: alertStatsResult.rows,
        alert_trends: alertTrendsResult.rows,
        high_risk_customers: highRiskCustomersResult.rows,
        sar_statistics: sarStatsResult.rows[0] || { sars_filed: 0, pending_sars: 0, total_alerts: 0 },
        generated_at: new Date().toISOString()
    };
};

// Update sanctions lists (would typically be called by a scheduled job)
export const updateSanctionsList = async (
    listName: string,
    source: string,
    entities: Array<{
        entity_type: 'individual' | 'company' | 'vessel' | 'aircraft';
        primary_name: string;
        aliases?: string[];
        date_of_birth?: string;
        place_of_birth?: string;
        nationality?: string;
        identification_numbers?: string[];
        addresses?: string[];
        sanctions_date?: string;
        sanctions_reason?: string;
        reference_number?: string;
    }>
): Promise<void> => {
    const client = await query('BEGIN', []);
    
    try {
        // Create or update sanctions list
        const listResult = await query(`
            INSERT INTO sanctions_lists (list_id, list_name, source, last_updated)
            VALUES ($1, $2, $3, CURRENT_DATE)
            ON CONFLICT (list_name, source) 
            DO UPDATE SET last_updated = CURRENT_DATE
            RETURNING list_id
        `, [uuidv4(), listName, source]);
        
        const listId = listResult.rows[0].list_id;
        
        // Clear existing entities for this list
        await query('DELETE FROM sanctioned_entities WHERE list_id = $1', [listId]);
        
        // Insert new entities
        for (const entity of entities) {
            await query(`
                INSERT INTO sanctioned_entities (
                    entity_id, list_id, entity_type, primary_name, aliases,
                    date_of_birth, place_of_birth, nationality, identification_numbers,
                    addresses, sanctions_date, sanctions_reason, reference_number
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                uuidv4(),
                listId,
                entity.entity_type,
                entity.primary_name,
                entity.aliases,
                entity.date_of_birth,
                entity.place_of_birth,
                entity.nationality,
                entity.identification_numbers,
                entity.addresses,
                entity.sanctions_date,
                entity.sanctions_reason,
                entity.reference_number
            ]);
        }
        
        await query('COMMIT', []);
        
    } catch (error) {
        await query('ROLLBACK', []);
        throw error;
    }
};

// Risk assessment for customers
export const assessCustomerRisk = async (customerId: string): Promise<any> => {
    const customer = await query(
        'SELECT * FROM customers WHERE customer_id = $1',
        [customerId]
    );
    
    if (customer.rows.length === 0) {
        throw new Error('Customer not found');
    }
    
    const customerData = customer.rows[0];
    let riskScore = 0;
    const riskFactors: string[] = [];
    
    // PEP status
    if (customerData.is_pep) {
        riskScore += 30;
        riskFactors.push('Politically Exposed Person');
    }
    
    // High income
    if (customerData.monthly_income > 1000000) {
        riskScore += 15;
        riskFactors.push('High income customer');
    }
    
    // Recent AML alerts
    const recentAlertsResult = await query(`
        SELECT COUNT(*) as alert_count
        FROM aml_alerts
        WHERE customer_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '90 days'
    `, [customerId]);
    
    const recentAlerts = parseInt(recentAlertsResult.rows[0].alert_count);
    if (recentAlerts > 0) {
        riskScore += recentAlerts * 10;
        riskFactors.push(`${recentAlerts} recent AML alerts`);
    }
    
    // Transaction patterns
    const transactionStatsResult = await query(`
        SELECT 
            COUNT(*) as transaction_count,
            AVG(t.amount) as avg_amount,
            MAX(t.amount) as max_amount
        FROM transactions t
        JOIN accounts a ON t.account_id = a.account_id
        WHERE a.customer_id = $1 
        AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND t.status = 'completed'
    `, [customerId]);
    
    const transactionStats = transactionStatsResult.rows[0];
    if (transactionStats.transaction_count > 100) {
        riskScore += 10;
        riskFactors.push('High transaction frequency');
    }
    
    if (parseFloat(transactionStats.max_amount) > 5000000) {
        riskScore += 20;
        riskFactors.push('High value transactions');
    }
    
    // Determine risk rating
    let riskRating: 'low' | 'medium' | 'high';
    if (riskScore >= 50) {
        riskRating = 'high';
    } else if (riskScore >= 25) {
        riskRating = 'medium';
    } else {
        riskRating = 'low';
    }
    
    // Update customer risk rating if changed
    if (customerData.risk_rating !== riskRating) {
        await query(
            'UPDATE customers SET risk_rating = $1 WHERE customer_id = $2',
            [riskRating, customerId]
        );
    }
    
    return {
        customer_id: customerId,
        risk_score: riskScore,
        risk_rating: riskRating,
        risk_factors: riskFactors,
        assessment_date: new Date().toISOString(),
        previous_rating: customerData.risk_rating
    };
};