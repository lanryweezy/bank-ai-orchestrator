
import React from 'react';
import Layout from '@/components/Layout';
import CustomerManagement from '@/components/CustomerManagement';

const CustomerManagementPage = () => {
  return (
    <Layout>
      <div className="p-6">
        <CustomerManagement />
      </div>
    </Layout>
  );
};

export default CustomerManagementPage;
