import * as express from 'express';
import { z, ZodError } from 'zod';
import {
    createAccount,
    createAccountSchema,
    getAccountById,
    getAccountByNumber,
    getCustomerAccounts,
    transferFunds,
    getAccountTransactions,
    freezeAccount,
    unfreezeAccount,
    closeAccount,
    generateAccountStatement
} from '../../services/corebanking/accountService';
import { authenticateToken, isBankUser } from '../../middleware/authMiddleware';

const router = express.Router();

// Schema for transfer funds
const transferFundsSchema = z.object({
    from_account_id: z.string().uuid(),
    to_account_number: z.string().min(1),
    amount: z.number().positive(),
    description: z.string().min(1),
    channel: z.enum(['branch', 'atm', 'pos', 'ussd', 'mobile_app', 'internet_banking', 'agent', 'api']),
    device_info: z.any().optional(),
    location: z.string().optional()
});

// Schema for account actions
const accountActionSchema = z.object({
    reason: z.string().min(1)
});

// Schema for statement generation
const statementSchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

// Create new account
router.post('/', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const validatedData = createAccountSchema.parse(req.body);
        const account = await createAccount(validatedData);
        res.status(201).json(account);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to create account' });
    }
});

// Get account by ID
router.get('/:accountId', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { accountId } = req.params;
        const account = await getAccountById(accountId);
        
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        
        res.json(account);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve account' });
    }
});

// Get account by account number
router.get('/number/:accountNumber', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { accountNumber } = req.params;
        const account = await getAccountByNumber(accountNumber);
        
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        
        res.json(account);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve account' });
    }
});

// Get customer accounts
router.get('/customer/:customerId', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { customerId } = req.params;
        const accounts = await getCustomerAccounts(customerId);
        res.json(accounts);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve customer accounts' });
    }
});

// Transfer funds between accounts
router.post('/transfer', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const validatedData = transferFundsSchema.parse(req.body);
        const userId = req.user!.userId;
        
        const transferResult = await transferFunds({
            from_account_id: validatedData.from_account_id,
            to_account_number: validatedData.to_account_number,
            amount: validatedData.amount,
            description: validatedData.description,
            channel: validatedData.channel,
            initiated_by: userId,
            device_info: validatedData.device_info,
            location: validatedData.location
        });
        
        res.status(201).json(transferResult);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Transfer failed' });
    }
});

// Get account transactions
router.get('/:accountId/transactions', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { accountId } = req.params;
        const {
            limit = '50',
            offset = '0',
            startDate,
            endDate,
            transactionType,
            channel
        } = req.query;

        const options = {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            startDate: startDate as string,
            endDate: endDate as string,
            transactionType: transactionType as string,
            channel: channel as string
        };

        const transactions = await getAccountTransactions(accountId, options);
        res.json(transactions);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to retrieve transactions' });
    }
});

// Freeze account
router.post('/:accountId/freeze', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { accountId } = req.params;
        const validatedData = accountActionSchema.parse(req.body);
        const userId = req.user!.userId;
        
        const account = await freezeAccount(accountId, validatedData.reason, userId);
        res.json(account);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to freeze account' });
    }
});

// Unfreeze account
router.post('/:accountId/unfreeze', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { accountId } = req.params;
        const userId = req.user!.userId;
        
        const account = await unfreezeAccount(accountId, userId);
        res.json(account);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to unfreeze account' });
    }
});

// Close account
router.post('/:accountId/close', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { accountId } = req.params;
        const validatedData = accountActionSchema.parse(req.body);
        const userId = req.user!.userId;
        
        const account = await closeAccount(accountId, validatedData.reason, userId);
        res.json(account);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(400).json({ message: error.message || 'Failed to close account' });
    }
});

// Generate account statement
router.post('/:accountId/statement', authenticateToken, isBankUser, async (req: express.Request, res: express.Response) => {
    try {
        const { accountId } = req.params;
        const validatedData = statementSchema.parse(req.body);
        
        const statement = await generateAccountStatement(
            accountId, 
            validatedData.start_date, 
            validatedData.end_date
        );
        
        res.json(statement);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors 
            });
        }
        res.status(500).json({ message: error.message || 'Failed to generate statement' });
    }
});

export default router;