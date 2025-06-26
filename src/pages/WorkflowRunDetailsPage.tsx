import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowRun, Task } from '@/types/workflows'; // Assuming Task type is also in workflows.ts
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Terminal, ListChecks, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format } from 'date-fns';
import TaskActionModal from '@/components/TaskActionModal';


const WorkflowRunDetailsPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [runDetails, setRunDetails] = useState<WorkflowRun | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);


  const fetchRunDetailsAndTasks = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const runPromise = apiClient<WorkflowRun>(`/workflow-runs/${runId}`);
      const tasksPromise = apiClient<Task[]>(`/tasks?runId=${runId}`);

      const [runData, tasksData] = await Promise.all([runPromise, tasksPromise]);
      setRunDetails(runData);
      setTasks(tasksData);

    } catch (err: any) {
      setError(err.message || `Failed to fetch details for run ID ${runId}.`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRunDetailsAndTasks();
  }, [fetchRunDetailsAndTasks]);

  const getStatusBadgeVariant = (status: WorkflowRun['status'] | Task['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'pending': return 'outline';
      case 'assigned': return 'outline';
      case 'failed': return 'destructive';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'assigned': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleViewActionTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleModalClose = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskCompleted = (updatedTask: Task) => {
    // Refresh tasks or update the specific task in the list
    setTasks(prevTasks =>
      prevTasks.map(t => t.task_id === updatedTask.task_id ? updatedTask : t)
    );
    // Potentially re-fetch run details if task completion affects run status
    fetchRunDetailsAndTasks();
  };


  if (loading) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
          <Skeleton className="h-8 w-1/4 mt-6" />
          <Card><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6">
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
           <Button variant="outline" onClick={() => navigate('/workflow-runs')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workflow Runs
          </Button>
        </div>
      </Layout>
    );
  }

  if (!runDetails) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p>Workflow run not found.</p>
           <Button variant="outline" onClick={() => navigate('/workflow-runs')} className="mt-4">
             <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workflow Runs
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/workflow-runs')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to All Runs
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                <div>
                    <CardTitle className="text-xl md:text-2xl">Workflow Run: {runDetails.workflow_name || 'N/A'} <span className="text-sm text-gray-500">v{runDetails.workflow_version}</span></CardTitle>
                    <CardDescription className="text-sm text-gray-500">Run ID: {runDetails.run_id}</CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(runDetails.status)} className="text-sm self-start sm:self-auto">
                    {runDetails.status}
                </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p><strong>Current Step:</strong> {runDetails.current_step_name || 'N/A'}</p>
                <p><strong>Started:</strong> {format(new Date(runDetails.start_time), "PPpp")}</p>
                {runDetails.end_time && <p><strong>Ended:</strong> {format(new Date(runDetails.end_time), "PPpp")}</p>}
                {runDetails.triggering_user_id && <p><strong>Triggered by:</strong> User {runDetails.triggering_user_id.substring(0,8)}...</p>}
            </div>
            {runDetails.triggering_data_json && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Triggering Data:</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto max-h-40">{JSON.stringify(runDetails.triggering_data_json, null, 2)}</pre>
              </div>
            )}
            {runDetails.results_json && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Final Results:</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto max-h-40">{JSON.stringify(runDetails.results_json, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><ListChecks className="h-5 w-5 mr-2 text-indigo-600" /> Tasks for this Run</h2>
            {tasks.length === 0 ? (
                <p className="text-gray-500">No tasks found for this workflow run.</p>
            ) : (
                <div className="space-y-3">
                    {tasks.map(task => (
                        <Card key={task.task_id}>
                            <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                                    <div>
                                        <h4 className="font-medium flex items-center">
                                            {getStatusIcon(task.status)}
                                            <span className="ml-2">{task.step_name_in_workflow}</span>
                                        </h4>
                                        <p className="text-xs text-gray-500 ml-6">Task ID: {task.task_id.substring(0,8)}... | Type: {task.type}</p>
                                    </div>
                                    <Badge variant={getStatusBadgeVariant(task.status)} className="text-xs self-start sm:self-auto mt-1 sm:mt-0">{task.status}</Badge>
                                </div>
                                {(task.type === 'human_review' || task.type === 'data_input' || task.type === 'decision') && task.status !== 'completed' && (
                                    <div className="mt-2 text-right">
                                        <Button size="sm" variant="outline" onClick={() => handleViewActionTask(task)}>
                                            View / Action
                                        </Button>
                                    </div>
                                )}
                                {task.status === 'completed' && task.output_data_json && (
                                     <details className="text-xs mt-2">
                                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View Output</summary>
                                        <pre className="mt-1 bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32">
                                            {JSON.stringify(task.output_data_json, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
        <TaskActionModal
            task={selectedTask}
            isOpen={isTaskModalOpen}
            onClose={handleModalClose}
            onTaskCompleted={handleTaskCompleted}
        />
      </div>
    </Layout>
  );
};

export default WorkflowRunDetailsPage;
