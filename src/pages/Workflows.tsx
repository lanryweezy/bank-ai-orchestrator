
import React from 'react';
import Layout from '@/components/Layout';
import WorkflowBuilder from '@/components/WorkflowBuilder';

const Workflows = () => {
  return (
    <Layout>
      <div className="p-6">
        <WorkflowBuilder />
      </div>
    </Layout>
  );
};

export default Workflows;
