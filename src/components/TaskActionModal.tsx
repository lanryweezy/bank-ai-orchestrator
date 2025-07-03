import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button';
import { Label } from "@/components/ui/label';
import { Textarea } from "@/components/ui/textarea';
import { Task, TaskComment } from '@/types/workflows'; // Added TaskComment
import apiClient from '@/services/apiClient';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, MessageSquare, Send, UserCircle } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import UserSelector from '../admin/UserSelector'; // Import UserSelector

interface TaskActionModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskCompleted: (updatedTask: Task) => void; // Callback to refresh task list or update UI
}

const TaskActionModal: React.FC<TaskActionModalProps> = ({ task, isOpen, onClose, onTaskCompleted }) => {
  const [outputData, setOutputData] = useState<string>('{}');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Delegation State
  const [showDelegateForm, setShowDelegateForm] = useState<boolean>(false);
  const [targetUserIdToDelegate, setTargetUserIdToDelegate] = useState<string>('');
  const [delegationError, setDelegationError] = useState<string|null>(null);
  const [isDelegating, setIsDelegating] = useState<boolean>(false);

  // Placeholder for current user ID - replace with actual auth context logic
  const currentLoggedInUserId = localStorage.getItem('userId'); // Example: Get from localStorage


  const fetchComments = async (currentTask: Task) => {
    if (!currentTask) return;
    try {
      const fetchedComments = await apiClient<TaskComment[]>(`/tasks/${currentTask.task_id}/comments`);
      setComments(fetchedComments);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
      setCommentError("Could not load comments.");
    }
  };

  useEffect(() => {
    if (task && isOpen) {
      setOutputData('{}'); // Reset output data
      fetchComments(task); // Fetch comments when modal opens with a task
      setNewComment(''); // Reset new comment input
    }
    setError(null);
    setCommentError(null);
  }, [task, isOpen]);

  if (!task) return null;

  const canCompleteTask = task.status !== 'completed' && task.status !== 'failed' &&
                         (task.type === 'human_review' || task.type === 'data_input' || task.type === 'decision');

  const handleSubmit = async () => {
    if (!canCompleteTask) return;
    setIsSubmitting(true);
    setError(null);
    let parsedOutputData = {};
    try {
      parsedOutputData = JSON.parse(outputData);
    } catch (e) {
      setError("Invalid JSON format for output data.");
      setIsSubmitting(false);
      return;
    }

    try {
      const updatedTask = await apiClient<Task>(`/tasks/${task.task_id}/complete`, {
        method: 'POST',
        data: { output_data_json: parsedOutputData },
      });
      onTaskCompleted(updatedTask);
      onClose(); // Close modal on success
    } catch (err: any) {
      setError(err.data?.message || err.message || 'Failed to complete task.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      console.error(err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDelegateSubmit = async () => {
    if (!task || !targetUserIdToDelegate.trim()) return;
    setIsDelegating(true);
    setDelegationError(null);
    try {
      const updatedTask = await apiClient<Task>(`/tasks/${task.task_id}/delegate`, {
        method: 'POST',
        data: { targetUserId: targetUserIdToDelegate },
      });
      onTaskCompleted(updatedTask); // Notify parent to refresh/update
      setShowDelegateForm(false);    // Close delegation form
      setTargetUserIdToDelegate('');
      onClose(); // Close the main modal as task state has changed significantly
    } catch (err: any) {
      setDelegationError(err.data?.message || err.message || "Failed to delegate task.");
      console.error("Delegation error:", err);
    } finally {
      setIsDelegating(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]"> {/* Increased width for comments */}
        <DialogHeader>
          <DialogTitle>Task: {task.step_name_in_workflow}</DialogTitle>
          <DialogDescription>
            Workflow: {task.workflow_name || task.run_id} (ID: {task.run_id.substring(0,8)}...) <br/>
            Type: {task.type} | Status: <span className={`font-semibold ${task.status === 'completed' ? 'text-green-600' : task.status === 'pending' ? 'text-yellow-600' : 'text-gray-600'}`}>{task.status}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh]">
          {/* Left Column: Task Details & Actions */}
          <div className="space-y-3 overflow-y-auto pr-2">
            <div>
              <Label className="font-semibold">Task ID:</Label>
              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{task.task_id}</p>
            </div>
            {task.deadline_at && (
            <div>
                <Label className="font-semibold">Deadline:</Label>
                <p className={`text-sm p-1 rounded ${new Date(task.deadline_at) < new Date() && task.status !== 'completed' ? 'text-red-600 bg-red-50 font-semibold' : 'text-gray-700 bg-gray-50'}`}>
                    {format(new Date(task.deadline_at), "PPpp")}
                    {new Date(task.deadline_at) < new Date() && task.status !== 'completed' && <span className="ml-1">(Overdue)</span>}
                </p>
            </div>
            )}
            {task.is_delegated && (
                 <div>
                    <Label className="font-semibold">Delegation Status:</Label>
                    <p className="text-sm text-purple-700 bg-purple-50 p-2 rounded">
                        This task was delegated.
                        {task.delegated_by_user_id && ` (Original delegator ID: ${task.delegated_by_user_id.substring(0,8)}...)`}
                    </p>
                </div>
            )}
            {task.status === 'requires_escalation' && (
                 <div>
                    <Label className="font-semibold">Escalation Status:</Label>
                    <p className="text-sm text-orange-700 bg-orange-50 p-2 rounded">
                        This task requires escalation / special attention.
                    </p>
                </div>
            )}


            {task.input_data_json && Object.keys(task.input_data_json).length > 0 && (
              <div>
                <Label className="font-semibold">Input Data:</Label>
                <pre className="text-sm bg-gray-50 p-3 rounded-md overflow-auto max-h-40">
                  {JSON.stringify(task.input_data_json, null, 2)}
                </pre>
              </div>
            )}

            {task.status === 'completed' && task.output_data_json && Object.keys(task.output_data_json).length > 0 && (
              <div>
                <Label className="font-semibold">Output Data:</Label>
                <pre className="text-sm bg-gray-50 p-3 rounded-md overflow-auto max-h-40">
                  {JSON.stringify(task.output_data_json, null, 2)}
                </pre>
              </div>
            )}

            {canCompleteTask && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="outputData" className="font-semibold">Your Output / Action Data (JSON):</Label>
                <Textarea
                  id="outputData"
                  value={outputData}
                  onChange={(e) => setOutputData(e.target.value)}
                  placeholder='Enter JSON data, e.g., {"reviewOutcome": "approved", "comments": "Looks good."}'
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Provide the output required to complete this task. For a 'human_review' from the loan workflow, this might be:
                  <code className="block bg-gray-100 p-1 rounded text-xs mt-1">{`{"reviewOutcome": "approved", "reviewComments": "All documents verified."}`}</code>
                </p>
              </div>
            )}
             {error && (
              <Alert variant="destructive" className="mt-4">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Action Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Column: Comments */}
          <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0 flex flex-col">
            <h3 className="text-lg font-semibold flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-blue-600" />Comments</h3>
            <div className="flex-grow space-y-3 overflow-y-auto pr-1 max-h-[40vh] bg-slate-50 p-3 rounded-md">
              {comments.length === 0 && <p className="text-sm text-gray-500 italic">No comments yet.</p>}
              {comments.map(comment => (
                <div key={comment.comment_id} className="text-sm p-2.5 bg-white rounded-md shadow-sm border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-blue-700 flex items-center">
                        <UserCircle className="h-4 w-4 mr-1.5 text-gray-400"/>
                        {comment.user?.full_name || comment.user?.username || 'User'}
                    </p>
                    <p className="text-xs text-gray-400" title={new Date(comment.created_at).toLocaleString()}>
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
                </div>
              ))}
            </div>
            {commentError && (
                 <Alert variant="destructive" className="text-xs p-2">
                    <Terminal className="h-3 w-3" />
                    <AlertTitle className="text-xs font-semibold">Comment Error</AlertTitle>
                    <AlertDescription className="text-xs">{commentError}</AlertDescription>
                </Alert>
            )}
            <div className="mt-auto space-y-2 pt-2">
              <Label htmlFor="newComment" className="font-semibold text-sm">Add a comment</Label>
              <div className="flex items-start space-x-2">
                <Textarea
                  id="newComment"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment..."
                  rows={2}
                  className="flex-grow"
                />
                <Button type="button" size="icon" onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()} className="bg-blue-600 hover:bg-blue-700 text-white h-full">
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send comment</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>

          {/* Delegate Button - show if task assigned to current user and not terminal */}
          {task.assigned_to_user_id === currentLoggedInUserId &&
           !['completed', 'failed', 'skipped'].includes(task.status) &&
           !showDelegateForm && (
            <Button type="button" variant="outline" onClick={() => { setShowDelegateForm(true); setDelegationError(null); }} className="mr-auto">
                Delegate Task
            </Button>
          )}

          {canCompleteTask && !showDelegateForm && (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="banking-gradient text-white">
              {isSubmitting ? 'Submitting...' : 'Complete Task'}
            </Button>
          )}
        </DialogFooter>

        {/* Delegation Form/Modal section */}
        {showDelegateForm && task && (
            <div className="mt-4 pt-4 border-t">
                <DialogHeader>
                    <DialogTitle className="text-lg">Delegate Task: {task.step_name_in_workflow}</DialogTitle>
                    <DialogDescription>Assign this task to another user.</DialogDescription>
                </DialogHeader>
import UserSelector from '../admin/UserSelector'; // Import UserSelector

// ... (rest of imports)

// ... (inside TaskActionModal component)
                <div className="py-4 space-y-3">
                    <div>
                        <Label htmlFor="targetUserId">Delegate to User</Label>
                        <UserSelector
                            selectedUserId={targetUserIdToDelegate}
                            onSelectUser={(userId) => setTargetUserIdToDelegate(userId || '')}
                            placeholder="Search and select a user..."
                        />
                    </div>
                    {delegationError && (
                        <Alert variant="destructive">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Delegation Error</AlertTitle>
                            <AlertDescription>{delegationError}</AlertDescription>
                        </Alert>
                    )}
                </div>
                <DialogFooter>
                     <Button type="button" variant="outline" onClick={() => {setShowDelegateForm(false); setTargetUserIdToDelegate('');}}>Cancel</Button>
                     <Button
                        type="button"
                        onClick={handleDelegateSubmit}
                        disabled={isDelegating || !targetUserIdToDelegate.trim()}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                     >
                        {isDelegating ? 'Delegating...' : 'Confirm Delegation'}
                    </Button>
                </DialogFooter>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TaskActionModal;
