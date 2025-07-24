export interface LoanApplication {
  id: string;
  customerName: string;
  customerBVN: string;
  loanType: string;
  requestedAmount: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
  creditScore: number;
  applicationDate: string;
  purpose: string;
  repaymentPeriod: number;
}
