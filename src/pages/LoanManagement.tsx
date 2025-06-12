
import React from 'react';
import Layout from '@/components/Layout';
import LoanManagement from '@/components/LoanManagement';

const LoanManagementPage = () => {
  return (
    <Layout>
      <div className="p-6">
        <LoanManagement />
      </div>
    </Layout>
  );
};

export default LoanManagementPage;
