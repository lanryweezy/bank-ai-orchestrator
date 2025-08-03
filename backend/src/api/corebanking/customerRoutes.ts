import * as express from 'express';
import { z, ZodError } from 'zod';
import {
    createCustomer,
    createCustomerSchema,
    getCustomerById,
    getCustomerByNumber,
    getCustomerByEmail,
    getCustomerByBVN,
    searchCustomers,
    updateCustomerKYC,
    kycUpdateSchema,
    suspendCustomer,
    reactivateCustomer,
    updateCustomer,
    getCustomerSummary,
    verifyBVN
} from '../../services/corebanking/customerService';
import { assessCustomerRisk } from '../../services/corebanking/complianceService';
import { authenticateToken, isBankUser } from '../../middleware/authMiddleware';

const router = express.Router();

// Create new customer
router.post('/', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const validatedData = createCustomerSchema.parse(req.body);
        const createdBy = req.user!.userId;
        
        const customer = await createCustomer(validatedData, createdBy);
        res.status(201).json(customer);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to create customer' });
    }
});

// Get customer by ID
router.get('/:customerId', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const customer = await getCustomerById(customerId);
        
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        res.json(customer);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve customer' });
    }
});

// Get customer by customer number
router.get('/number/:customerNumber', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerNumber } = req.params;
        const customer = await getCustomerByNumber(customerNumber);
        
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        res.json(customer);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve customer' });
    }
});

// Get customer by email
router.get('/email/:email', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { email } = req.params;
        const customer = await getCustomerByEmail(email);
        
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        res.json(customer);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve customer' });
    }
});

// Get customer by BVN
router.get('/bvn/:bvn', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { bvn } = req.params;
        const customer = await getCustomerByBVN(bvn);
        
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        res.json(customer);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve customer' });
    }
});

// Search customers
router.get('/', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const {
            search,
            kyc_status,
            customer_tier,
            status,
            limit = '50',
            offset = '0'
        } = req.query;

        const options = {
            search: search as string,
            kyc_status: kyc_status as string,
            customer_tier: customer_tier as string,
            status: status as string,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        };

        const customers = await searchCustomers(options);
        res.json(customers);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to search customers' });
    }
});

// Update customer KYC
router.put('/:customerId/kyc', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const validatedData = kycUpdateSchema.parse(req.body);
        const updatedBy = req.user!.userId;
        
        const customer = await updateCustomerKYC(customerId, validatedData, updatedBy);
        res.json(customer);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to update customer KYC' });
    }
});

// Suspend customer
router.post('/:customerId/suspend', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const { reason } = req.body;
        const suspendedBy = req.user!.userId;
        
        if (!reason) {
            return res.status(400).json({ message: 'Suspension reason is required' });
        }
        
        const customer = await suspendCustomer(customerId, reason, suspendedBy);
        res.json(customer);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to suspend customer' });
    }
});

// Reactivate customer
router.post('/:customerId/reactivate', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const reactivatedBy = req.user!.userId;
        
        const customer = await reactivateCustomer(customerId, reactivatedBy);
        res.json(customer);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to reactivate customer' });
    }
});

// Update customer information
router.put('/:customerId', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const updatedBy = req.user!.userId;
        
        const customer = await updateCustomer(customerId, req.body, updatedBy);
        res.json(customer);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to update customer' });
    }
});

// Get customer summary
router.get('/:customerId/summary', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const summary = await getCustomerSummary(customerId);
        res.json(summary);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve customer summary' });
    }
});

// Verify BVN
router.post('/:customerId/verify-bvn', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const { bvn } = req.body;
        
        if (!bvn) {
            return res.status(400).json({ message: 'BVN is required' });
        }
        
        const customer = await getCustomerById(customerId);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        const verificationResult = await verifyBVN(bvn, customer);
        res.json(verificationResult);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'BVN verification failed' });
    }
});

// Assess customer risk
router.post('/:customerId/assess-risk', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const riskAssessment = await assessCustomerRisk(customerId);
        res.json(riskAssessment);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Risk assessment failed' });
    }
});

export default router;