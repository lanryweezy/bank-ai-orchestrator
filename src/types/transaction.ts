export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  channel: 'USSD' | 'Mobile App' | 'Internet Banking' | 'ATM' | 'POS' | 'Agent';
  status: 'successful' | 'pending' | 'failed';
  timestamp: string;
  reference: string;
  customerName: string;
  accountNumber: string;
}
