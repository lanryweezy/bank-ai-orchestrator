export const mockNotifications = [
  {
    id: '1',
    type: 'error',
    title: 'Agent Failure',
    message: 'Credit Analyzer failed to process loan application due to missing documents',
    timestamp: '2 minutes ago',
    agent: 'Credit Analyzer',
    read: false
  },
  {
    id: '2',
    type: 'success',
    title: 'Task Completed',
    message: 'Monthly compliance report has been generated successfully',
    timestamp: '15 minutes ago',
    agent: 'Compliance Bot',
    read: false
  },
  {
    id: '3',
    type: 'warning',
    title: 'High Load Alert',
    message: 'Email Parser is experiencing high volume - response time may be affected',
    timestamp: '1 hour ago',
    agent: 'Email Parser',
    read: true
  },
  {
    id: '4',
    type: 'info',
    title: 'Knowledge Base Updated',
    message: 'HR Assistant knowledge base has been updated with new policies',
    timestamp: '2 hours ago',
    agent: 'HR Assistant',
    read: true
  }
];
