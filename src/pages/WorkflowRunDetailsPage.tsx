import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowRun, Task, TaskComment } from '@/types/workflows'; // Added TaskComment
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Terminal, ListChecks, CheckCircle, Clock, AlertCircle, MessageSquare, Send, UserCircle } from "lucide-react"; // Added icons
import { format, formatDistanceToNow } from 'date-fns'; // Added formatDistanceToNow
import TaskActionModal from '@/components/TaskActionModal'; // This modal will now also host comments


// Component for displaying a single task card with its comments
interface TaskCardProps {
  task: Task;
  onViewAction: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onViewAction }) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(false);

  const fetchComments = useCallback(async () => {
    if (!task) return;
    setLoadingComments(true);
    setCommentError(null);
    try {
      const fetchedComments = await apiClient<TaskComment[]>(`/tasks/${task.task_id}/comments`);
      setComments(fetchedComments);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
      setCommentError("Could not load comments for this task.");
    } finally {
      setLoadingComments(false);
    }
  }, [task]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, fetchComments]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    setIsSubmittingComment(true);
    setCommentError(null);
    try {
      const addedComment = await apiClient<TaskComment>(`/tasks/${task.task_id}/comments`, {
        method: 'POST',
        data: { comment_text: newComment },
      });
      setComments(prev => [...prev, addedComment]);
      setNewComment('');
    } catch (err: any) {
      setCommentError(err.data?.message || err.message || "Failed to add comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getStatusBadgeVariant = (status: Task['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'pending': return 'outline';
      case 'assigned': return 'outline';
      case 'failed': return 'destructive';
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

  return (
    <Card>
      <CardHeader className="pb-3">
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
      </CardHeader>
      <CardContent className="text-sm">
         {task.due_date && (
            <p className="text-xs text-gray-500 mb-2">
                Due: {format(new Date(task.due_date), "PPpp")}
                {new Date(task.due_date) < new Date() && task.status !== 'completed' &&
                    <span className="text-red-500 font-semibold ml-1">(Overdue)</span>}
            </p>
        )}
        {(task.type === 'human_review' || task.type === 'data_input' || task.type === 'decision') && task.status !== 'completed' && (
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => onViewAction(task)}>
              View / Action
            </Button>
          </div>
        )}
        {task.status === 'completed' && task.output_data_json && Object.keys(task.output_data_json).length > 0 && (
          <details className="text-xs mt-2">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View Output</summary>
            <pre className="mt-1 bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(task.output_data_json, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start pt-3 border-t">
        <Button variant="link" size="sm" onClick={() => setShowComments(!showComments)} className="px-0 py-1 text-blue-600 hover:text-blue-800">
          <MessageSquare className="h-4 w-4 mr-1.5" /> {showComments ? 'Hide Comments' : `Show Comments (${loadingComments ? '...' : comments.length})`}
        </Button>
        {showComments && (
          <div className="w-full mt-2 space-y-3">
            {loadingComments && <Skeleton className="h-10 w-full" />}
            {commentError && <Alert variant="destructive" className="text-xs p-2"><AlertDescription>{commentError}</AlertDescription></Alert>}
            {!loadingComments && !commentError && comments.length === 0 && <p className="text-xs text-gray-500 italic">No comments for this task.</p>}
            {!loadingComments && !commentError && comments.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 p-2 rounded-md">
                {comments.map(comment => (
                  <div key={comment.comment_id} className="text-xs p-2 bg-white rounded shadow-sm border">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-semibold text-blue-700 flex items-center">
                        <UserCircle className="h-3.5 w-3.5 mr-1 text-gray-400"/>
                        {comment.user?.full_name || comment.user?.username || 'User'}
                      </p>
                      <p className="text-xxs text-gray-400" title={new Date(comment.created_at).toLocaleString()}>
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 space-y-1">
              <Label htmlFor={`newComment-${task.task_id}`} className="text-xs font-semibold">Add comment:</Label>
              <div className="flex items-start space-x-1.5">
                <Textarea
                  id={`newComment-${task.task_id}`}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type comment..."
                  rows={1}
                  className="flex-grow text-xs"
                />
                <Button type="button" size="sm" onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()} className="bg-blue-600 hover:bg-blue-700 text-white h-auto py-1.5 px-2.5">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};


const WorkflowRunDetailsPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [runDetails, setRunDetails] = useState<WorkflowRun | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);

  // Helper to parse the fully qualified step name for display
  const getDisplayStepName = (fqStepName: string | null | undefined ): string => {
    if (!fqStepName) return 'N/A';
    // Example: "parallelStep.branchName.actualStepName" -> "actualStepName (Branch: branchName)"
    // This is a simple parser, could be made more robust.
    const parts = fqStepName.split('.');
    if (parts.length === 3) { // Assuming parallel.branch.step
        return `${parts[2]} (Branch: ${parts[1]})`;
    }
    return fqStepName; // Return as is if not in the expected parallel format
  };


  const fetchRunDetailsAndTasks = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const runPromise = apiClient<WorkflowRun>(`/workflow-runs/${runId}`);
      // Fetch tasks associated with the run ID. The backend /tasks route needs to support this.
      // Assuming it does, or this needs adjustment.
      // The current /tasks route is for user's tasks. We need one for run's tasks or adjust existing.
      // For now, let's assume /tasks?runId=... exists and returns tasks for that run.
      const tasksPromise = apiClient<Task[]>(`/tasks?runId=${runId}`); // This query param might not exist yet

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

  // This function is specific to the overall run, not individual tasks
   const getRunStatusBadgeVariant = (status: WorkflowRun['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'pending': return 'outline';
      case 'failed': return 'destructive';
      case 'cancelled': return 'destructive';
      default: return 'outline';
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

  const handleTaskCompletedOrCommented = () => { // Renamed to reflect it's also used for comment updates
    // Re-fetch everything to ensure UI consistency after task completion or new comment
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
                <Badge variant={getRunStatusBadgeVariant(runDetails.status)} className="text-sm self-start sm:self-auto">
                    {runDetails.status}
                </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p><strong>Current Step:</strong> {getDisplayStepName(runDetails.current_step_name)}</p>
                <p><strong>Started:</strong> {format(new Date(runDetails.start_time), "PPpp")}</p>
                {runDetails.end_time && <p><strong>Ended:</strong> {format(new Date(runDetails.end_time), "PPpp")}</p>}
                {runDetails.triggering_user_id && <p><strong>Triggered by:</strong> User {runDetails.triggering_user_id.substring(0,8)}...</p>}
            </div>
             {runDetails.active_parallel_branches && Object.keys(runDetails.active_parallel_branches).length > 0 && (
              <div className="mt-2">
                <h4 className="font-semibold text-sm mb-1">Active Parallel Branches Status:</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto max-h-40">
                  {JSON.stringify(runDetails.active_parallel_branches, null, 2)}
                </pre>
              </div>
            )}
            {runDetails.triggering_data_json && Object.keys(runDetails.triggering_data_json).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Triggering Data:</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto max-h-40">{JSON.stringify(runDetails.triggering_data_json, null, 2)}</pre>
              </div>
            )}
            {runDetails.results_json && Object.keys(runDetails.results_json).length > 0 &&(
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
                <div className="space-y-4">
                    {tasks.map(task => (
                       <TaskCard key={task.task_id} task={task} onViewAction={handleViewActionTask} />
                    ))}
                </div>
            )}
        </div>
        <TaskActionModal
            task={selectedTask}
            isOpen={isTaskModalOpen}
            onClose={handleModalClose}
            onTaskCompleted={handleTaskCompletedOrCommented} // Use the updated handler
        />
      </div>
    </Layout>
  );
};

export default WorkflowRunDetailsPage;
