import * as express from 'express';
import { z, ZodError } from 'zod';
import {
    createAMLAlert,
    createAMLAlertSchema,
    monitorTransaction,
    screenCustomer,
    getAMLAlerts,
    updateAMLAlertStatus,
    fileSAR,
    getComplianceDashboard,
    updateSanctionsList,
    assessCustomerRisk
} from '../../services/corebanking/complianceService';
import { authenticateToken, isBankUser, isPlatformAdmin } from '../../middleware/authMiddleware';

const router = express.Router();

// Schema for updating alert status
const updateAlertStatusSchema = z.object({
    status: z.enum(['open', 'investigating', 'closed', 'escalated', 'false_positive']),
    assigned_to: z.string().uuid().optional(),
    notes: z.string().optional()
});

// Schema for filing SAR
const fileSARSchema = z.object({
    sar_reference: z.string().min(1)
});

// Create AML Alert
router.post('/alerts', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const validatedData = createAMLAlertSchema.parse(req.body);
        const alert = await createAMLAlert(validatedData);
        res.status(201).json(alert);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to create AML alert' });
    }
});

// Get AML Alerts with filtering
router.get('/alerts', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const {
            status,
            severity,
            alert_type,
            customer_id,
            assigned_to,
            start_date,
            end_date,
            limit = '50',
            offset = '0'
        } = req.query;

        const options = {
            status: status as string,
            severity: severity as string,
            alert_type: alert_type as string,
            customer_id: customer_id as string,
            assigned_to: assigned_to as string,
            start_date: start_date as string,
            end_date: end_date as string,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        };

        const alerts = await getAMLAlerts(options);
        res.json(alerts);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve AML alerts' });
    }
});

// Update AML Alert Status
router.put('/alerts/:alertId/status', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { alertId } = req.params;
        const validatedData = updateAlertStatusSchema.parse(req.body);
        const updatedBy = req.user!.userId;
        
        const alert = await updateAMLAlertStatus(
            alertId,
            validatedData.status,
            validatedData.assigned_to,
            validatedData.notes,
            updatedBy
        );
        
        res.json(alert);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to update alert status' });
    }
});

// File SAR (Suspicious Activity Report)
router.post('/alerts/:alertId/file-sar', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { alertId } = req.params;
        const validatedData = fileSARSchema.parse(req.body);
        const filedBy = req.user!.userId;
        
        const alert = await fileSAR(alertId, validatedData.sar_reference, filedBy);
        res.json(alert);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to file SAR' });
    }
});

// Screen customer against sanctions lists
router.post('/screen-customer/:customerId', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const screeningResult = await screenCustomer(customerId);
        res.json(screeningResult);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Customer screening failed' });
    }
});

// Monitor transaction for compliance
router.post('/monitor-transaction', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const transaction = req.body;
        
        if (!transaction.transaction_id || !transaction.customer_id || !transaction.amount) {
            return res.status(400).json({ 
                message: 'Transaction ID, customer ID, and amount are required' 
            });
        }
        
        await monitorTransaction(transaction);
        res.json({ message: 'Transaction monitoring completed' });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Transaction monitoring failed' });
    }
});

// Get compliance dashboard
router.get('/dashboard', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const dashboard = await getComplianceDashboard();
        res.json(dashboard);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve compliance dashboard' });
    }
});

// Assess customer risk
router.post('/assess-risk/:customerId', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const riskAssessment = await assessCustomerRisk(customerId);
        res.json(riskAssessment);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Risk assessment failed' });
    }
});

// Update sanctions list (Admin only)
router.post('/sanctions-list', authenticateToken, isPlatformAdmin, async (req: express.Request, res: express.Response) => {
    try {
        const { list_name, source, entities } = req.body;
        
        if (!list_name || !source || !entities || !Array.isArray(entities)) {
            return res.status(400).json({ 
                message: 'List name, source, and entities array are required' 
            });
        }
        
        await updateSanctionsList(list_name, source, entities);
        res.json({ 
            message: 'Sanctions list updated successfully',
            list_name,
            source,
            entities_count: entities.length
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to update sanctions list' });
    }
});

// Compliance statistics endpoint
router.get('/statistics', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { period = '30' } = req.query;
        const periodDays = parseInt(period as string);
        
        // This could be expanded to provide more detailed statistics
        const dashboard = await getComplianceDashboard();
        
        res.json({
            period_days: periodDays,
            ...dashboard
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve compliance statistics' });
    }
});

export default router;