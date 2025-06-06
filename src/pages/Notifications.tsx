
import React from 'react';
import Layout from '@/components/Layout';
import NotificationCenter from '@/components/NotificationCenter';

const Notifications = () => {
  return (
    <Layout>
      <div className="p-6">
        <NotificationCenter />
      </div>
    </Layout>
  );
};

export default Notifications;
