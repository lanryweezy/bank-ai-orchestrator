
import React from 'react';
import Layout from '@/components/Layout';
import SecurityDashboard from '@/components/SecurityDashboard';

const Security = () => {
  return (
    <Layout>
      <div className="p-6">
        <SecurityDashboard />
      </div>
    </Layout>
  );
};

export default Security;
