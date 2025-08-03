// Banking Domain Types

export interface Customer {
  id: string;
  name: string;
  bvn: string;
  phone: string;
  email: string;
  accountTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  kycStatus: 'pending' | 'verified' | 'rejected';
  accountNumber: string;
  balance: number;
  createdDate: string;
  address?: string;
  dateOfBirth?: string;
  occupation?: string;
  nextOfKin?: string;
  nextOfKinPhone?: string;
}

export interface Account {
  accountId: string;
  customerId: string;
  accountNumber: string;
  accountType: 'savings' | 'current' | 'fixed_deposit' | 'loan';
  currency: string;
  balance: number;
  availableBalance: number;
  status: 'active' | 'inactive' | 'frozen' | 'closed';
  dateOpened: string;
  interestRate?: number;
  minimumBalance?: number;
  maximumBalance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  channel: 'USSD' | 'Mobile App' | 'Internet Banking' | 'ATM' | 'POS' | 'Agent' | 'Branch';
  status: 'successful' | 'pending' | 'failed' | 'reversed';
  timestamp: string;
  reference: string;
  customerName: string;
  accountNumber: string;
  balanceAfter?: number;
  fees?: number;
  beneficiaryAccount?: string;
  beneficiaryBank?: string;
  beneficiaryName?: string;
}

export interface LoanApplication {
  id: string;
  customerId: string;
  customerName: string;
  customerBVN: string;
  loanType: 'personal' | 'business' | 'mortgage' | 'auto' | 'payday' | 'overdraft';
  requestedAmount: number;
  approvedAmount?: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'active' | 'closed';
  creditScore: number;
  applicationDate: string;
  approvalDate?: string;
  disbursementDate?: string;
  purpose: string;
  repaymentPeriod: number; // in months
  interestRate?: number;
  monthlyPayment?: number;
  collateral?: string;
  guarantors?: Guarantor[];
  documents?: LoanDocument[];
}

export interface Guarantor {
  id: string;
  name: string;
  bvn: string;
  phone: string;
  email: string;
  relationship: string;
  employer: string;
  monthlyIncome: number;
  address: string;
}

export interface LoanDocument {
  id: string;
  type: 'identity' | 'income' | 'bank_statement' | 'utility_bill' | 'employment_letter' | 'other';
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface Card {
  cardId: string;
  accountId: string;
  cardNumber: string; // masked
  cardType: 'debit' | 'credit' | 'prepaid';
  status: 'active' | 'inactive' | 'blocked' | 'expired';
  expiryDate: string;
  dailyLimit: number;
  monthlyLimit: number;
  issuedDate: string;
  lastUsed?: string;
}

export interface Bill {
  billId: string;
  customerId: string;
  category: 'utilities' | 'telecom' | 'cable_tv' | 'internet' | 'insurance' | 'government' | 'education';
  biller: string;
  amount: number;
  reference: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentDate?: string;
  transactionRef?: string;
}

export interface Investment {
  investmentId: string;
  customerId: string;
  productType: 'fixed_deposit' | 'treasury_bills' | 'bonds' | 'mutual_funds' | 'stocks';
  amount: number;
  interestRate: number;
  tenure: number; // in days
  maturityDate: string;
  status: 'active' | 'matured' | 'liquidated' | 'rolled_over';
  createdAt: string;
  maturityAmount: number;
}

export interface Notification {
  id: string;
  customerId: string;
  type: 'transaction' | 'account' | 'loan' | 'card' | 'security' | 'promotional';
  title: string;
  message: string;
  status: 'unread' | 'read';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  readAt?: string;
  actionRequired: boolean;
  actionUrl?: string;
}

export interface SecurityEvent {
  eventId: string;
  customerId: string;
  eventType: 'login' | 'password_change' | 'transaction' | 'card_usage' | 'profile_update';
  description: string;
  ipAddress: string;
  device: string;
  location: string;
  status: 'normal' | 'suspicious' | 'blocked';
  timestamp: string;
  riskScore: number;
}

// Compliance and Risk Types
export interface KYCDocument {
  documentId: string;
  customerId: string;
  documentType: 'bvn' | 'nin' | 'passport' | 'drivers_license' | 'voters_card' | 'utility_bill';
  documentNumber: string;
  expiryDate?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
}

export interface AMLAlert {
  alertId: string;
  customerId: string;
  transactionId?: string;
  alertType: 'suspicious_transaction' | 'large_transaction' | 'unusual_pattern' | 'sanctioned_entity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'investigating' | 'closed' | 'false_positive';
  createdAt: string;
  assignedTo?: string;
  resolution?: string;
  closedAt?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form Types
export interface CustomerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bvn: string;
  dateOfBirth: string;
  address: string;
  occupation: string;
  monthlyIncome: number;
  nextOfKin: string;
  nextOfKinPhone: string;
  accountType: 'savings' | 'current';
  initialDeposit: number;
}

export interface LoanApplicationFormData {
  loanType: LoanApplication['loanType'];
  requestedAmount: number;
  purpose: string;
  repaymentPeriod: number;
  monthlyIncome: number;
  employmentStatus: 'employed' | 'self_employed' | 'unemployed' | 'retired';
  employer: string;
  workAddress: string;
  collateralType?: string;
  collateralValue?: number;
  guarantors: Omit<Guarantor, 'id'>[];
}

// Dashboard Stats Types
export interface DashboardStats {
  totalCustomers: number;
  totalAccounts: number;
  totalDeposits: number;
  totalLoans: number;
  totalTransactions: number;
  todayTransactions: number;
  activeLoans: number;
  pendingKYC: number;
  monthlyGrowth: {
    customers: number;
    deposits: number;
    loans: number;
  };
}

// Search and Filter Types
export interface CustomerSearchParams {
  query?: string;
  kycStatus?: Customer['kycStatus'];
  accountTier?: Customer['accountTier'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface TransactionSearchParams {
  accountNumber?: string;
  type?: Transaction['type'];
  status?: Transaction['status'];
  channel?: Transaction['channel'];
  amountFrom?: number;
  amountTo?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface LoanSearchParams {
  status?: LoanApplication['status'];
  loanType?: LoanApplication['loanType'];
  amountFrom?: number;
  amountTo?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}