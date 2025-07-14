import { Database, Mail, CreditCard, Globe } from 'lucide-react';
import { Integration, AvailableService } from '@/types/integrations';

export const mockIntegrations: Integration[] = [
  {
    id: '1',
    name: 'BankOne Core Banking',
    type: 'Core Banking',
    status: 'connected',
    description: 'Primary core banking system integration',
    icon: Database
  },
  {
    id: '2',
    name: 'Gmail API',
    type: 'Email Service',
    status: 'connected', 
    description: 'Email processing and automation',
    icon: Mail
  },
  {
    id: '3',
    name: 'Paystack',
    type: 'Payment Gateway',
    status: 'connected',
    description: 'Payment processing and verification',
    icon: CreditCard
  },
  {
    id: '4',
    name: 'CBN BVN Service',
    type: 'Identity Verification',
    status: 'error',
    description: 'BVN lookup and validation',
    icon: Globe
  }
];

export const availableServices: AvailableService[] = [
  {
    id: '1',
    name: 'Finacle Core Banking',
    description: 'Connect to Finacle core banking system',
    icon: Database
  },
  {
    id: '2',
    name: 'NIBSS API',
    description: 'Nigerian Inter-Bank Settlement System',
    icon: Globe
  }
];