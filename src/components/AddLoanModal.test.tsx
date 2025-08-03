import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddLoanModal from './AddLoanModal';

describe('AddLoanModal', () => {
  it('opens the modal when the trigger button is clicked', () => {
    render(<AddLoanModal onLoanAdded={() => {}} />);

    fireEvent.click(screen.getByText('New Application'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls the onLoanAdded callback when the form is submitted', () => {
    const onLoanAdded = jest.fn();
    render(<AddLoanModal onLoanAdded={onLoanAdded} />);

    fireEvent.click(screen.getByText('New Application'));

    fireEvent.change(screen.getByLabelText('Customer Name'), {
      target: { value: 'John Doe' },
    });
    fireEvent.change(screen.getByLabelText('Customer BVN'), {
      target: { value: '12345678901' },
    });
    fireEvent.change(screen.getByLabelText('Loan Type'), {
      target: { value: 'Personal Loan' },
    });
    fireEvent.change(screen.getByLabelText('Requested Amount'), {
      target: { value: '100000' },
    });
    fireEvent.change(screen.getByLabelText('Purpose'), {
      target: { value: 'Test Purpose' },
    });
    fireEvent.change(screen.getByLabelText('Repayment Period (months)'), {
      target: { value: '12' },
    });

    fireEvent.click(screen.getByText('Submit Application'));

    expect(onLoanAdded).toHaveBeenCalledWith({
      id: expect.any(String),
      customerName: 'John Doe',
      customerBVN: '12345678901',
      loanType: 'Personal Loan',
      requestedAmount: 100000,
      status: 'pending',
      creditScore: 0,
      applicationDate: expect.any(String),
      purpose: 'Test Purpose',
      repaymentPeriod: 12,
    });
  });
});
