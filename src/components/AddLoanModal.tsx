import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator } from 'lucide-react';

interface AddLoanModalProps {
  onLoanAdded: (loan: any) => void;
}

const AddLoanModal: React.FC<AddLoanModalProps> = ({ onLoanAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerBVN, setCustomerBVN] = useState('');
  const [loanType, setLoanType] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [repaymentPeriod, setRepaymentPeriod] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newLoan = {
      id: `LN${Math.floor(Math.random() * 1000)}`,
      customerName,
      customerBVN,
      loanType,
      requestedAmount: parseInt(requestedAmount, 10),
      status: 'pending',
      creditScore: 0,
      applicationDate: new Date().toISOString().split('T')[0],
      purpose,
      repaymentPeriod: parseInt(repaymentPeriod, 10),
    };
    onLoanAdded(newLoan);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="banking-gradient text-white">
          <Calculator className="h-4 w-4 mr-2" />
          New Application
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Loan Application</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="customerName">Customer Name</Label>
            <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="customerBVN">Customer BVN</Label>
            <Input id="customerBVN" value={customerBVN} onChange={(e) => setCustomerBVN(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="loanType">Loan Type</Label>
            <Input id="loanType" value={loanType} onChange={(e) => setLoanType(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="requestedAmount">Requested Amount</Label>
            <Input id="requestedAmount" type="number" value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="purpose">Purpose</Label>
            <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="repaymentPeriod">Repayment Period (months)</Label>
            <Input id="repaymentPeriod" type="number" value={repaymentPeriod} onChange={(e) => setRepaymentPeriod(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">Submit Application</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLoanModal;
