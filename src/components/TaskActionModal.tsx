import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button';
import { Label } from "@/components/ui/label';
import { Textarea } from "@/components/ui/textarea';
import { Task } from '@/types/workflows';
import apiClient from '@/services/apiClient';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

interface TaskActionModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskCompleted: (updatedTask: Task) => void; // Callback to refresh task list or update UI
}

const TaskActionModal: React.FC<TaskActionModalProps> = ({ task, isOpen, onClose, onTaskCompleted }) => {
  const [outputData, setOutputData] = useState<string>('{}');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset form when task changes or modal opens
    if (task) {
      // Pre-fill outputData if task has a form_schema or expected output structure (simplified for now)
      // For example, if task.type === 'human_review' and a schema exists for its output.
      // Here, just resetting to empty JSON object.
      setOutputData('{}');
    }
    setError(null);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Task: {task.step_name_in_workflow}</DialogTitle>
          <DialogDescription>
            Workflow: {task.workflow_name || task.run_id} (ID: {task.run_id}) <br/>
            Type: {task.type} | Status: <span className={`font-semibold ${task.status === 'completed' ? 'text-green-600' : task.status === 'pending' ? 'text-yellow-600' : 'text-gray-600'}`}>{task.status}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <Label className="font-semibold">Task ID:</Label>
            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{task.task_id}</p>
          </div>

          {task.input_data_json && Object.keys(task.input_data_json).length > 0 && (
            <div>
              <Label className="font-semibold">Input Data:</Label>
              <pre className="text-sm bg-gray-50 p-3 rounded-md overflow-auto max-h-48">
                {JSON.stringify(task.input_data_json, null, 2)}
              </pre>
            </div>
          )}

          {task.status === 'completed' && task.output_data_json && Object.keys(task.output_data_json).length > 0 && (
             <div>
              <Label className="font-semibold">Output Data:</Label>
              <pre className="text-sm bg-gray-50 p-3 rounded-md overflow-auto max-h-48">
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
        </div>
        {error && (
            <Alert variant="destructive" className="mb-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
          {canCompleteTask && (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="banking-gradient text-white">
              {isSubmitting ? 'Submitting...' : 'Complete Task'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskActionModal;
