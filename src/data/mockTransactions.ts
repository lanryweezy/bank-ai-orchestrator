export const mockTransactions = [
  {
    id: '1',
    type: 'credit',
    amount: 50000,
    description: 'Transfer from Access Bank',
    channel: 'Mobile App',
    status: 'successful',
    timestamp: '2024-01-15 14:30:25',
    reference: 'TXN001234567',
    customerName: 'Adebayo Johnson',
    accountNumber: '2001234567'
  },
  {
    id: '2',
    type: 'debit',
    amount: 25000,
    description: 'POS Purchase - Shoprite',
    channel: 'POS',
    status: 'successful',
    timestamp: '2024-01-15 12:15:10',
    reference: 'TXN001234568',
    customerName: 'Fatima Abubakar',
    accountNumber: '2001234568'
  },
  {
    id: '3',
    type: 'debit',
    amount: 5000,
    description: 'ATM Withdrawal',
    channel: 'ATM',
    status: 'failed',
    timestamp: '2024-01-15 09:45:33',
    reference: 'TXN001234569',
    customerName: 'Chidi Okafor',
    accountNumber: '2001234569'
  }
];
