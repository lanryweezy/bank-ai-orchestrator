
import React from 'react';
import Layout from '@/components/Layout';
import AgentMonitor from '@/components/AgentMonitor';

const Monitor = () => {
  return (
    <Layout>
      <div className="p-6">
        <AgentMonitor />
      </div>
    </Layout>
  );
};

export default Monitor;
