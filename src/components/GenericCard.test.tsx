import React from 'react';
import { render, screen } from '@testing-library/react';
import GenericCard from './GenericCard';

describe('GenericCard', () => {
  it('renders the title and children', () => {
    render(
      <GenericCard title="Test Title">
        <div>Test Children</div>
      </GenericCard>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(
      <GenericCard title="Test Title" subtitle="Test Subtitle">
        <div>Test Children</div>
      </GenericCard>
    );

    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(
      <GenericCard title="Test Title" icon={<span>Test Icon</span>}>
        <div>Test Children</div>
      </GenericCard>
    );

    expect(screen.getByText('Test Icon')).toBeInTheDocument();
  });

  it('renders the status and status color when provided', () => {
    render(
      <GenericCard
        title="Test Title"
        status="Test Status"
        statusColor="bg-green-500"
      >
        <div>Test Children</div>
      </GenericCard>
    );

    expect(screen.getByText('Test Status')).toBeInTheDocument();
    expect(screen.getByText('Test Status').previousElementSibling).toHaveClass('bg-green-500');
  });
});
