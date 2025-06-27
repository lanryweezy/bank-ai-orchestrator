import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/services/apiClient';
import { Task } from '@/types/workflows';
import TaskActionModal from './TaskActionModal'; // New modal component
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input'; // For search
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw,
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Briefcase, // Generic icon for task
  Eye // For View/Action button
} from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { format } from 'date-fns'; // Import format function

const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // In a real app, you might filter by status on the backend via query params
      const data = await apiClient<Task[]>('/tasks');
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleViewActionTask = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskCompleted = (updatedTask: Task) => {
    // Refresh the list or update the specific task in the list
    setTasks(prevTasks =>
      prevTasks.map(t => t.task_id === updatedTask.task_id ? updatedTask : t)
    );
    // fetchTasks(); // Or just refetch all
  };


  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default'; // Greenish in some themes
      case 'in_progress': return 'secondary'; // Bluish/Yellowish
      case 'pending': return 'outline'; // Grayish
      case 'assigned': return 'outline';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };
   const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'assigned': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />; // For pending, etc.
    }
  };


  const filteredTasks = tasks
    .filter(task => {
      if (activeTab === 'all') return true;
      if (activeTab === 'in_progress' && (task.status === 'in_progress' || task.status === 'assigned')) return true;
      return task.status === activeTab;
    })
    .filter(task =>
      (task.step_name_in_workflow?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.workflow_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.task_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Tasks</h2>
         <Button variant="outline" size="sm" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Tasks
        </Button>
        {/* <Button className="banking-gradient text-white" disabled>
          <Plus className="h-4 w-4 mr-2" /> Create Task (Not Applicable)
        </Button> */}
      </div>

      <div className="flex space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by task name, workflow name, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {/* <Button variant="outline" disabled>
          <Filter className="h-4 w-4 mr-2" />
          Filter (Not Implemented)
        </Button> */}
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {loading && (
             <div className="space-y-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          )}
          {error && (
             <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error Loading Tasks</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!loading && !error && filteredTasks.length === 0 && (
            <p className="text-center py-10 text-gray-500">
                {activeTab === 'all' ? 'No tasks assigned to you.' : `No ${activeTab} tasks.`}
            </p>
          )}
          {!loading && !error && filteredTasks.map((task) => (
            <Card key={task.task_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row items-start justify-between">
                  <div className="flex-1 mb-3 md:mb-0">
                    <div className="flex items-center space-x-2 mb-1">
                      {getStatusIcon(task.status)}
                      <h3 className="font-semibold text-md md:text-lg">{task.step_name_in_workflow}</h3>
                      <Badge variant={getStatusVariant(task.status)} className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                        Workflow: {task.workflow_name || 'N/A'} (Run ID: {task.run_id.substring(0,8)}...)
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      Type: {task.type}
                      {task.assigned_to_agent_id && ` (Agent: ${task.assigned_to_agent_id.substring(0,8)}...)`}
                    </p>
                    {task.due_date && (
                        <p className={`text-xs mt-1 ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            Due: {format(new Date(task.due_date), "PPpp")}
                            {new Date(task.due_date) < new Date() && task.status !== 'completed' && <span className="ml-1">(Overdue)</span>}
                        </p>
                    )}
                  </div>
                  <div className="flex space-x-2 self-start md:self-center">
                    <Button variant="outline" size="sm" onClick={() => handleViewActionTask(task)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View / Action
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <TaskActionModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onTaskCompleted={handleTaskCompleted}
      />
    </div>
  );
};

export default TaskManager;
