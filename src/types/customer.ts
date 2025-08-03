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
}
