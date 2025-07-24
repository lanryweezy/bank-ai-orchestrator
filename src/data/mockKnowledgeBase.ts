export const mockAgents = [
  { id: 'credit-analyzer', name: 'Credit Analyzer', department: 'Loans' },
  { id: 'chatbot', name: 'Customer Support Bot', department: 'Customer Service' },
  { id: 'email-parser', name: 'Email Parser', department: 'Operations' },
  { id: 'kyc-validator', name: 'KYC Validator', department: 'Compliance' },
];

export const mockKnowledgeItems = [
  {
    id: 1,
    type: 'rule',
    title: 'BVN Requirement',
    content: 'All loan applications must include a valid BVN number',
    category: 'Loan Processing',
    lastUpdated: '2024-01-15'
  },
  {
    id: 2,
    type: 'template',
    title: 'Loan Approval Response',
    content: 'Dear {{customer_name}}, your loan application for ₦{{amount}} has been approved...',
    category: 'Communication',
    lastUpdated: '2024-01-10'
  },
  {
    id: 3,
    type: 'rule',
    title: 'Income Verification',
    content: 'Monthly income must be at least 2x the requested loan amount',
    category: 'Loan Processing',
    lastUpdated: '2024-01-12'
  },
];
