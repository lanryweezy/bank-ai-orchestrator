
import React from 'react';
import Layout from '@/components/Layout';
import TaskManager from '@/components/TaskManager';

const Tasks = () => {
  return (
    <Layout>
      <div className="p-6">
        <TaskManager />
      </div>
    </Layout>
  );
};

export default Tasks;
