import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddCustomerModal from './AddCustomerModal';

describe('AddCustomerModal', () => {
  it('opens the modal when the trigger button is clicked', () => {
    render(<AddCustomerModal onCustomerAdded={() => {}} />);

    fireEvent.click(screen.getByText('Add Customer'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls the onCustomerAdded callback when the form is submitted', () => {
    const onCustomerAdded = jest.fn();
    render(<AddCustomerModal onCustomerAdded={onCustomerAdded} />);

    fireEvent.click(screen.getByText('Add Customer'));

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'John Doe' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john.doe@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '1234567890' },
    });
    fireEvent.change(screen.getByLabelText('BVN'), {
      target: { value: '12345678901' },
    });

    fireEvent.click(screen.getByText('Add Customer'));

    expect(onCustomerAdded).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '1234567890',
      bvn: '12345678901',
      accountTier: 'Tier 1',
      kycStatus: 'pending',
      accountNumber: expect.any(String),
      balance: 0,
      createdDate: expect.any(String),
    });
  });
});
