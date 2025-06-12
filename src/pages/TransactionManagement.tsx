
import React from 'react';
import Layout from '@/components/Layout';
import TransactionManagement from '@/components/TransactionManagement';

const TransactionManagementPage = () => {
  return (
    <Layout>
      <div className="p-6">
        <TransactionManagement />
      </div>
    </Layout>
  );
};

export default TransactionManagementPage;
