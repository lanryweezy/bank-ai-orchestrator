import React, { useState, useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { WorkflowDefinition } from '@/types/workflows';
import WorkflowDefinitionCard from './WorkflowDefinitionCard';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Send } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Terminal } from "lucide-react";

// Helper to render form fields for initialContextSchema (Simplified)
const renderInitialContextField = (
    key: string,
    propSchema: any,
    value: any,
    handleChange: (fieldKey: string, fieldValue: any) => void
) => {
    const label = propSchema.description || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    if (propSchema.type === 'string') {
        return (
            <div key={key} className="space-y-1">
                <Label htmlFor={`init-${key}`} className="text-sm">{label}</Label>
                <Input id={`init-${key}`} type="text" value={value || ''} onChange={(e) => handleChange(key, e.target.value)} placeholder={propSchema.examples ? String(propSchema.examples[0]) : ''} />
            </div>
        );
    } else if (propSchema.type === 'number' || propSchema.type === 'integer') {
         return (
            <div key={key} className="space-y-1">
                <Label htmlFor={`init-${key}`} className="text-sm">{label}</Label>
                <Input id={`init-${key}`} type="number" value={value || ''} onChange={(e) => handleChange(key, e.target.value === '' ? undefined : Number(e.target.value))} placeholder={propSchema.examples ? String(propSchema.examples[0]) : ''} />
            </div>
        );
    }
    // Add more types as needed (boolean, etc.)
    // For complex objects or arrays, default to JSON Textarea for simplicity in this modal
    return (
        <div key={key} className="space-y-1">
            <Label htmlFor={`init-${key}`} className="text-sm">{label} (JSON)</Label>
            <Textarea
                id={`init-${key}`}
                value={typeof value === 'string' ? value : (value ? JSON.stringify(value, null, 2) : (propSchema.type === 'array' ? '[]' : '{}'))}
                onChange={(e) => handleChange(key, e.target.value)} // Store as string, parse on submit
                rows={3}
                className="font-mono text-xs"
            />
        </div>
    );
};


const WorkflowManager: React.FC = () => { // Renamed from WorkflowBuilder to reflect its new role
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [triggeringData, setTriggeringData] = useState<Record<string, any>>({});
  const [startError, setStartError] = useState<string | null>(null);
  const [startSuccessMessage, setStartSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchWorkflowDefinitions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<WorkflowDefinition[]>('/workflows'); // Fetches active by default from service
      setWorkflowDefinitions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch workflow definitions.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflowDefinitions();
  }, []);

  const handleOpenStartModal = (workflowId: string, workflowName: string, initialSchema?: Record<string, any>) => {
    const wf = workflowDefinitions.find(w => w.workflow_id === workflowId);
    if (wf) {
        setSelectedWorkflow(wf);
        // Initialize triggeringData with defaults from schema
        const initialData: Record<string, any> = {};
        if (initialSchema?.properties) {
            for (const key in initialSchema.properties) {
                if (initialSchema.properties[key].default !== undefined) {
                    initialData[key] = initialSchema.properties[key].default;
                }
            }
        }
        setTriggeringData(initialData);
        setIsStartModalOpen(true);
        setStartError(null);
        setStartSuccessMessage(null);
    }
  };

  const handleTriggeringDataChange = (field: string, value: any) => {
    setTriggeringData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartWorkflowInstance = async () => {
    if (!selectedWorkflow) return;
    setIsSubmitting(true);
    setStartError(null);
    setStartSuccessMessage(null);

    let parsedData = { ...triggeringData };

    // Attempt to parse any fields that were input as JSON strings (from Textarea)
    if (selectedWorkflow.definition_json?.initialContextSchema?.properties) {
        for (const key in selectedWorkflow.definition_json.initialContextSchema.properties) {
            const propSchema = selectedWorkflow.definition_json.initialContextSchema.properties[key];
            if (propSchema.type === 'object' || propSchema.type === 'array') {
                 if (typeof parsedData[key] === 'string') {
                    try {
                        parsedData[key] = JSON.parse(parsedData[key]);
                    } catch (e) {
                        setStartError(`Invalid JSON for field: ${key}`);
                        setIsSubmitting(false);
                        return;
                    }
                 }
            }
        }
    }


    try {
      const result = await apiClient<any>(`/workflows/${selectedWorkflow.workflow_id}/start`, {
        method: 'POST',
        data: { triggering_data_json: parsedData },
      });
      setStartSuccessMessage(`Workflow "${selectedWorkflow.name}" started successfully! Run ID: ${result.run_id}`);
      // setIsStartModalOpen(false); // Optionally close modal on success
      // fetchWorkflowRuns(); // If displaying runs on this page
    } catch (err: any) {
      setStartError(err.data?.message || err.message || 'Failed to start workflow instance.');
      console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Available Workflows</h2>
        <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={fetchWorkflowDefinitions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {/* <Button className="banking-gradient text-white" disabled>
             <Plus className="h-4 w-4 mr-2" /> Create Workflow (Admin)
            </Button> */}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-8 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2 mb-3" />
                <Skeleton className="h-[100px] w-full rounded-xl" />
                <Skeleton className="h-10 w-full mt-2" />
            </div>
          ))}
        </div>
      )}

      {error && (
         <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error Loading Workflows</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}

      {!loading && !error && workflowDefinitions.length === 0 && (
        <p className="text-gray-600">No workflow definitions available.</p>
      )}

      {!loading && !error && workflowDefinitions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflowDefinitions.map((workflow) => (
            <WorkflowDefinitionCard
                key={workflow.workflow_id}
                workflow={workflow}
                onStartInstance={handleOpenStartModal}
            />
          ))}
        </div>
      )}

      {/* Dialog for Starting Workflow Instance */}
      <Dialog open={isStartModalOpen} onOpenChange={setIsStartModalOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Start Workflow: {selectedWorkflow?.name}</DialogTitle>
            <DialogDescription>
              Provide initial data required to start this workflow instance.
              Refer to the workflow's `initialContextSchema` for expected fields.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedWorkflow?.definition_json?.initialContextSchema?.properties ? (
                Object.entries(selectedWorkflow.definition_json.initialContextSchema.properties).map(([key, propSchema]) =>
                    renderInitialContextField(key, propSchema, triggeringData[key], handleTriggeringDataChange)
                )
            ) : (
                 <Label htmlFor="triggering_data_json">Triggering Data (JSON)</Label>
            )}
            {/* Always show a generic JSON textarea as a fallback or for additional data */}
            {!selectedWorkflow?.definition_json?.initialContextSchema?.properties && (
                 <Textarea
                    id="triggering_data_json"
                    value={typeof triggeringData === 'string' ? triggeringData : JSON.stringify(triggeringData, null, 2)}
                    onChange={(e) => {
                        // If no schema, treat entire input as one JSON blob
                        try {
                           const parsed = JSON.parse(e.target.value);
                           setTriggeringData(parsed); // This might be risky if schema is not present
                        } catch (jsonError) {
                           // Or just store the string and parse on submit
                           setTriggeringData(e.target.value as any);
                        }
                    }}
                    placeholder='Enter JSON data to trigger the workflow, e.g., {"applicationId": "123", ...}'
                    rows={8}
                    className="font-mono text-sm"
                />
            )}
          </div>
          {startError && <p className="text-sm text-red-600">{startError}</p>}
          {startSuccessMessage && <p className="text-sm text-green-600">{startSuccessMessage}</p>}
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => setStartSuccessMessage(null)}>Close</Button>
            </DialogClose>
            <Button type="button" onClick={handleStartWorkflowInstance} disabled={isSubmitting} className="banking-gradient text-white">
              {isSubmitting ? 'Starting...' : 'Start Instance'} <Send className="h-4 w-4 ml-2"/>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowManager; // Renamed from WorkflowBuilder
