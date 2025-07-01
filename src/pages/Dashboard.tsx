
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ListChecks, PlayCircle, Clock, AlertCircle, CheckCircle, ExternalLink, User, Activity } from 'lucide-react';
import { format } from 'date-fns';

// Define interfaces for the summary data
interface TaskSummaryItem {
  task_id: string;
  step_name_in_workflow: string;
  workflow_name: string;
  status: string;
  due_date?: string | null;
  created_at: string;
}
interface TaskSummary {
  counts: {
    pending: number;
    assigned: number;
    in_progress: number;
  };
  recent_tasks: TaskSummaryItem[];
}

interface WorkflowRunSummaryItem {
  run_id: string;
  workflow_name: string;
  status: string;
  start_time: string;
  current_step_name?: string | null;
  triggering_username?: string | null;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [recentRuns, setRecentRuns] = useState<WorkflowRunSummaryItem[] | null>(null);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(true);
  const [loadingRuns, setLoadingRuns] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoadingTasks(true);
        setLoadingRuns(true);
        setError(null);

        const taskSummaryPromise = apiClient<TaskSummary>('/tasks/summary?limit=5');
        const recentRunsPromise = apiClient<WorkflowRunSummaryItem[]>('/workflow-runs/summary?limit=5');

        const [taskData, runsData] = await Promise.all([taskSummaryPromise, recentRunsPromise]);
        setTaskSummary(taskData);
        setRecentRuns(runsData);

        // Get user name from localStorage (assuming it's stored after login)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUserName(user.full_name || user.username || 'User');
        }

      } catch (err: any) {
        console.error("Failed to fetch dashboard data:", err);
        setError(err.data?.message || err.message || "Could not load dashboard data.");
      } finally {
        setLoadingTasks(false);
        setLoadingRuns(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
        case 'completed': return 'text-green-600 bg-green-100';
        case 'in_progress': return 'text-blue-600 bg-blue-100';
        case 'pending': return 'text-yellow-600 bg-yellow-100';
        case 'assigned': return 'text-yellow-600 bg-yellow-100';
        case 'failed': return 'text-red-600 bg-red-100';
        case 'cancelled': return 'text-gray-600 bg-gray-100';
        default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'assigned': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };


  return (
    <Layout>
      <div className="p-6 space-y-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Welcome back, {userName || 'User'}!</h1>
          <p className="text-gray-600 mt-1">Here's an overview of your platform activity.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Tasks Widget */}
          <Card className="lg:col-span-2 hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-indigo-600" />My Tasks</CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>View All Tasks</Button>
              </div>
              {loadingTasks && !taskSummary && <Skeleton className="h-4 w-1/3 mt-1" />}
              {!loadingTasks && taskSummary && (
                <CardDescription>
                  {taskSummary.counts.pending + taskSummary.counts.assigned + taskSummary.counts.in_progress > 0
                    ? `You have ${taskSummary.counts.pending + taskSummary.counts.assigned + taskSummary.counts.in_progress} active tasks.`
                    : "No active tasks currently assigned."}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {loadingTasks ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : taskSummary && taskSummary.recent_tasks.length > 0 ? (
                <ul className="space-y-3">
                  {taskSummary.recent_tasks.map(task => (
                    <li key={task.task_id} className="p-3 bg-gray-50 rounded-md border hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <Link to={`/tasks`} className="font-medium text-indigo-700 hover:underline">{task.step_name_in_workflow}</Link>
                          <p className="text-xs text-gray-500">In: {task.workflow_name}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getStatusColor(task.status)}`}>{task.status}</span>
                      </div>
                      {task.due_date && (
                        <p className={`text-xs mt-1 ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                          Due: {format(new Date(task.due_date), "PP")}
                          {new Date(task.due_date) < new Date() && task.status !== 'completed' && <span className="ml-1">(Overdue)</span>}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic">No tasks to display.</p>
              )}
            </CardContent>
          </Card>

          {/* Task Counts Summary (Could be part of My Tasks or separate) */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                 <CardTitle className="flex items-center"><User className="mr-2 h-5 w-5 text-gray-500"/>Task Overview</CardTitle>
            </CardHeader>
            <CardContent>
                {loadingTasks ? (
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-6 w-2/3" />
                    </div>
                ) : taskSummary ? (
                    <ul className="space-y-2 text-sm">
                        <li className="flex justify-between"><span>Pending:</span> <span className="font-semibold">{taskSummary.counts.pending}</span></li>
                        <li className="flex justify-between"><span>Assigned:</span> <span className="font-semibold">{taskSummary.counts.assigned}</span></li>
                        <li className="flex justify-between"><span>In Progress:</span> <span className="font-semibold">{taskSummary.counts.in_progress}</span></li>
                    </ul>
                ) : <p className="text-sm text-gray-500 italic">No task data.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Recent Workflow Activity Widget */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="flex items-center"><Activity className="mr-2 h-5 w-5 text-green-600" />Recent Workflow Activity</CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate('/workflow-runs')}>View All Runs</Button>
            </div>
            <CardDescription>Latest workflow instances you've interacted with or have visibility on.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRuns ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : recentRuns && recentRuns.length > 0 ? (
              <ul className="space-y-3">
                {recentRuns.map(run => (
                  <li key={run.run_id} className="p-3 bg-gray-50 rounded-md border hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-center">
                        <div>
                            <Link to={`/workflow-runs/${run.run_id}`} className="font-medium text-green-700 hover:underline">{run.workflow_name}</Link>
                            <p className="text-xs text-gray-500">
                                Started: {format(new Date(run.start_time), "PPp")}
                                {run.triggering_username && ` by ${run.triggering_username}`}
                            </p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getStatusColor(run.status)}`}>{run.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Current step: {run.current_step_name || 'N/A'}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No recent workflow activity.</p>
            )}
          </CardContent>
        </Card>

        {/* Placeholder for other potential widgets (e.g., Agent Performance, System Health) */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader><CardTitle>Agent Performance</CardTitle></CardHeader>
                <CardContent><p className="italic text-gray-400">Agent performance metrics widget coming soon...</p></CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
                <CardContent><p className="italic text-gray-400">System health overview widget coming soon...</p></CardContent>
            </Card>
        </div> */}

      </div>
    </Layout>
  );
};

export default Dashboard;
