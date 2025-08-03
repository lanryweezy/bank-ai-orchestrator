import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddIntegrationModal from './AddIntegrationModal';

describe('AddIntegrationModal', () => {
  it('opens the modal when the trigger button is clicked', () => {
    render(<AddIntegrationModal onIntegrationAdded={() => {}} />);

    fireEvent.click(screen.getByText('Add Integration'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls the onIntegrationAdded callback when the form is submitted', () => {
    const onIntegrationAdded = jest.fn();
    render(<AddIntegrationModal onIntegrationAdded={onIntegrationAdded} />);

    fireEvent.click(screen.getByText('Add Integration'));

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Test Integration' },
    });
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'Test Type' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Test Description' },
    });

    fireEvent.click(screen.getByText('Add Integration'));

    expect(onIntegrationAdded).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'Test Integration',
      type: 'Test Type',
      status: 'inactive',
      description: 'Test Description',
    });
  });
});
