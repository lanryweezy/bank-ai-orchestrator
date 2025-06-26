
import React from 'react';
import Layout from '@/components/Layout';
import WorkflowManager from '@/components/WorkflowManager'; // Renamed import

const WorkflowsPage = () => { // Renamed page component for clarity
  return (
    <Layout>
      <div className="p-6">
        <WorkflowManager />
      </div>
    </Layout>
  );
};

export default WorkflowsPage; // Renamed export
