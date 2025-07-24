export const mockSecurityEvents = [
  {
    id: '1',
    type: 'login_attempt',
    severity: 'medium',
    message: 'Multiple failed login attempts from Credit Analyzer agent',
    timestamp: '2 minutes ago',
    agent: 'Credit Analyzer'
  },
  {
    id: '2',
    type: 'data_access',
    severity: 'low',
    message: 'Bulk customer data accessed by Compliance Bot',
    timestamp: '15 minutes ago',
    agent: 'Compliance Bot'
  },
  {
    id: '3',
    type: 'permission_change',
    severity: 'high',
    message: 'Agent permissions modified by Head of IT',
    timestamp: '1 hour ago',
    user: 'John Doe'
  }
];

export const mockAuditLogs = [
  {
    id: '1',
    action: 'Knowledge Base Updated',
    user: 'Head of Loans',
    agent: 'Credit Analyzer',
    timestamp: '10:30 AM',
    details: 'Updated credit scoring rules'
  },
  {
    id: '2',
    action: 'Agent Deployed',
    user: 'System Admin',
    agent: 'New Chatbot',
    timestamp: '09:15 AM',
    details: 'Customer service chatbot v2.1'
  }
];
