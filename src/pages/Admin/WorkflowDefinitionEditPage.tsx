import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowDefinition, WorkflowDefinitionInput, WorkflowStepDefinition } from '@/types/workflows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Save, ShieldAlert, AlertTriangle, PlusCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import StepConfigurator from '@/components/admin/StepConfigurator'; // Import StepConfigurator

const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

const WorkflowDefinitionEditPage: React.FC = () => {
  const { workflowId, baseWorkflowName } = useParams<{ workflowId?: string; baseWorkflowName?: string }>();
  const navigate = useNavigate();

  const isEditMode = Boolean(workflowId);
  const isCreateNewVersionMode = Boolean(baseWorkflowName);
  const isCreateBrandNewMode = !isEditMode && !isCreateNewVersionMode;

  const [pageTitle, setPageTitle] = useState<string>('Workflow Definition');
  const [definition, setDefinition] = useState<WorkflowDefinitionInput>({
    name: baseWorkflowName || '',
    description: '',
    definition_json: { steps: [], start_step: undefined }, // Ensure steps is array
    version: 1,
    is_active: true,
  });
  const [definitionJsonString, setDefinitionJsonString] = useState<string>(
    JSON.stringify({ description: "My new workflow", start_step: "initial_step", steps: [] }, null, 2)
  );
  const [currentSteps, setCurrentSteps] = useState<WorkflowStepDefinition[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const defaultJsonStructure = {
    description: "My new workflow version",
    start_step: "initial_step",
    steps: [
      {
        name: "initial_step",
        type: 'human_review' as const,
        assigned_role: "user",
        form_schema: { type: "object", properties: { comments: {type: "string"} } },
        transitions: []
      }
    ]
  };

  const fetchWorkflowDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isEditMode && workflowId) {
        const data = await apiClient<WorkflowDefinition>(`/admin/workflows/${workflowId}`);
        setDefinition({
          name: data.name,
          description: data.description || '',
          definition_json: data.definition_json || { steps: [], start_step: undefined },
          version: data.version,
          is_active: data.is_active,
        });
        setDefinitionJsonString(JSON.stringify(data.definition_json || { steps: [], start_step: undefined }, null, 2));
        setCurrentSteps(data.definition_json?.steps || []);
        setPageTitle(`Edit Workflow: ${data.name} (v${data.version})`);
      } else if (isCreateNewVersionMode && baseWorkflowName) {
        const versions = await apiClient<WorkflowDefinition[]>(`/admin/workflows/name/${baseWorkflowName}/versions`);
        if (versions && versions.length > 0) {
          const latestVersion = versions[0];
          const newVersionNumber = (latestVersion.version || 0) + 1;
          setDefinition(prev => ({
            ...prev, name: latestVersion.name, description: latestVersion.description || '',
            definition_json: latestVersion.definition_json || { steps: [], start_step: undefined },
            is_active: true, version: newVersionNumber
          }));
          setDefinitionJsonString(JSON.stringify(latestVersion.definition_json || { steps: [], start_step: undefined }, null, 2));
          setCurrentSteps(latestVersion.definition_json?.steps || []);
          setPageTitle(`Create New Version for: ${latestVersion.name} (Suggesting v${newVersionNumber})`);
        } else {
          setDefinition(prev => ({...prev, name: baseWorkflowName, definition_json: defaultJsonStructure, version: 1, is_active: true}));
          setDefinitionJsonString(JSON.stringify(defaultJsonStructure, null, 2));
          setCurrentSteps(defaultJsonStructure.steps);
          setPageTitle(`Create Workflow: ${baseWorkflowName} (v1)`);
        }
      } else { // Create Brand New Mode
        setDefinition({ name: '', description: '', definition_json: defaultJsonStructure, version: 1, is_active: true });
        setDefinitionJsonString(JSON.stringify(defaultJsonStructure, null, 2));
        setCurrentSteps(defaultJsonStructure.steps);
        setPageTitle('Create New Workflow Definition');
      }
    } catch (err: any) {
      setError(err.data?.message || err.message || 'Failed to fetch workflow data.');
       if (isCreateNewVersionMode && baseWorkflowName) { // Fallback for create new version if base fetch fails
         setDefinition(prev => ({...prev, name: baseWorkflowName, definition_json: defaultJsonStructure, version: 1, is_active: true}));
         setDefinitionJsonString(JSON.stringify(defaultJsonStructure, null, 2));
         setCurrentSteps(defaultJsonStructure.steps);
       }
    } finally {
      setLoading(false);
    }
  }, [workflowId, baseWorkflowName, isEditMode, isCreateNewVersionMode, defaultJsonStructure]);

  useEffect(() => {
    fetchWorkflowDetails();
  }, [fetchWorkflowDetails]);

  useEffect(() => {
    // Sync currentSteps from definition_json if it's valid
    if (definition.definition_json && Array.isArray(definition.definition_json.steps)) {
        if (JSON.stringify(currentSteps) !== JSON.stringify(definition.definition_json.steps)) {
            setCurrentSteps(definition.definition_json.steps);
        }
    } else if (currentSteps.length > 0) { // definition_json is empty/invalid but currentSteps has items
        setCurrentSteps([]);
    }
  }, [definition.definition_json]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setDefinition(prev => ({ ...prev, [name]: checked }));
    } else {
        if ((isEditMode || isCreateNewVersionMode) && (name === 'name' || name === 'version')) return;
        setDefinition(prev => ({ ...prev, [name]: name === 'version' ? (value === '' ? 1 : Number(value)) : value }));
    }
  };

  const handleDefinitionJsonChange = (value: string) => {
    setDefinitionJsonString(value);
    if (isValidJson(value)) {
      const parsedJson = JSON.parse(value);
      setDefinition(prev => ({ ...prev, definition_json: parsedJson }));
      // currentSteps will update via useEffect
      if (formError && formError.includes("Definition JSON")) setFormError(null);
    } else {
      setFormError('Definition JSON is not valid JSON. Please correct it.');
    }
  };

  const updateStepsInDefinition = (updatedSteps: WorkflowStepDefinition[]) => {
    setCurrentSteps(updatedSteps); // Update local step state first for UI responsiveness
    setDefinition(prevDef => {
      // Ensure definition_json exists and has a structure
      const baseJson = (typeof prevDef.definition_json === 'object' && prevDef.definition_json !== null)
                       ? { ...prevDef.definition_json }
                       : {};

      const newDefinitionJson = {
        ...baseJson,
        steps: updatedSteps
      };

      if (updatedSteps.length > 0 && !updatedSteps.find(s => s.name === newDefinitionJson.start_step)) {
        newDefinitionJson.start_step = updatedSteps[0].name;
      } else if (updatedSteps.length === 0) {
        newDefinitionJson.start_step = undefined;
      }

      setDefinitionJsonString(JSON.stringify(newDefinitionJson, null, 2));
      return { ...prevDef, definition_json: newDefinitionJson };
    });
  };

  const handleAddStep = () => {
    let newStepName = `step_${currentSteps.length}`;
    let RENAME_COUNTER = 0;
    while(currentSteps.find(s => s.name === newStepName)){
      newStepName = `step_${currentSteps.length}_${RENAME_COUNTER++}`;
    }
    const newStep: WorkflowStepDefinition = {
      name: newStepName,
      type: 'human_review',
      description: '',
      transitions: [],
      error_handling: { on_failure: { action: 'fail_workflow' } }
    };
    updateStepsInDefinition([...currentSteps, newStep]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError(null); setSuccessMessage(null); setFormError(null);

    let finalDefinitionJson = definition.definition_json;
    if (isValidJson(definitionJsonString)) {
        finalDefinitionJson = JSON.parse(definitionJsonString);
        // Ensure the steps from currentSteps are what's in finalDefinitionJson if structured editor was used
        if (Array.isArray(currentSteps) && JSON.stringify(finalDefinitionJson.steps) !== JSON.stringify(currentSteps)) {
            finalDefinitionJson.steps = currentSteps;
            // Also ensure start_step is valid based on currentSteps
            if (currentSteps.length > 0 && !currentSteps.find(s => s.name === finalDefinitionJson.start_step)) {
                finalDefinitionJson.start_step = currentSteps[0].name;
            } else if (currentSteps.length === 0) {
                finalDefinitionJson.start_step = undefined;
            }
        }
    } else {
      setFormError('Definition JSON is not valid JSON. Please correct it before saving.');
      setSaving(false); return;
    }
     if (!finalDefinitionJson.start_step && finalDefinitionJson.steps && finalDefinitionJson.steps.length > 0) {
        setFormError('A start_step must be defined if there are steps.');
        setSaving(false); return;
    }
    if (finalDefinitionJson.start_step && finalDefinitionJson.steps && !finalDefinitionJson.steps.find((s:any) => s.name === finalDefinitionJson.start_step)) {
        setFormError(`The defined start_step "${finalDefinitionJson.start_step}" does not match any of the step names.`);
        setSaving(false); return;
    }


    try {
      if (isEditMode && workflowId) {
        const payload: Partial<WorkflowDefinitionInput> = {
          description: definition.description, definition_json: finalDefinitionJson, is_active: definition.is_active,
        };
        const updatedDef = await apiClient<WorkflowDefinition>(`/admin/workflows/${workflowId}`, { method: 'PUT', data: payload });
        setSuccessMessage(`Workflow "${updatedDef.name}" (v${updatedDef.version}) updated!`);
      } else if (isCreateNewVersionMode && baseWorkflowName) {
        const payload = {
          description: definition.description, definition_json: finalDefinitionJson, is_active: definition.is_active,
        };
        // This API implies incrementing version on backend based on 'baseWorkflowName'
        const newVersion = await apiClient<WorkflowDefinition>(`/admin/workflows/name/${baseWorkflowName}/versions`, { method: 'POST', data: payload });
        setSuccessMessage(`New version (v${newVersion.version}) for "${newVersion.name}" created!`);
        setTimeout(() => navigate(`/admin/workflow-definitions/edit/${newVersion.workflow_id}`), 1500);
      } else {
         const payload: WorkflowDefinitionInput = {
            name: definition.name, description: definition.description, definition_json: finalDefinitionJson,
            version: Number(definition.version) || 1, is_active: definition.is_active,
        };
        const newDef = await apiClient<WorkflowDefinition>('/admin/workflows', { method: 'POST', data: payload });
        setSuccessMessage(`Workflow "${newDef.name}" (v${newDef.version || 1}) created!`);
        setTimeout(() => navigate(`/admin/workflow-definitions/edit/${newDef.workflow_id}`), 1500);
      }
    } catch (err: any) {
      console.error('Failed to save workflow definition:', err);
      const apiError = err.data?.message || err.message || 'Failed to save workflow definition.';
      setError(apiError);
      if (err.data?.errors) {
        const fieldErrors = err.data.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
        setFormError(`Validation failed: ${fieldErrors}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Loading and error states rendering (kept as is)
  if (loading) { /* ... skeleton ... */ }
  if (error && (error.includes('Forbidden') || error.includes('Unauthorized'))) { /* ... access denied ... */ }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/workflow-definitions')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">{pageTitle}</CardTitle>
            <CardDescription>
              {isEditMode && `Editing v${definition.version} of "${definition.name}".`}
              {isCreateNewVersionMode && `New version for "${baseWorkflowName}".`}
              {isCreateBrandNewMode && 'Define a new workflow.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Error Messages */}
              {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              {formError && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Validation Error</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert>)}
              {successMessage && (<Alert variant="default" className="bg-green-50 border-green-400 text-green-700"><AlertTitle>Success!</AlertTitle><AlertDescription>{successMessage}</AlertDescription></Alert>)}

              {/* Core Fields */}
              <div><Label htmlFor="name">Name</Label><Input id="name" name="name" value={definition.name} onChange={handleInputChange} required disabled={isEditMode || isCreateNewVersionMode} className="mt-1"/> {/* ... descriptions ... */}</div>
              <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" value={definition.description} onChange={handleInputChange} rows={3} className="mt-1"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="version">Version</Label><Input id="version" name="version" type="number" value={definition.version || ''} onChange={handleInputChange} required min="1" disabled={isEditMode || isCreateNewVersionMode} className="mt-1"/> {/* ... descriptions ... */} </div>
                <div className="flex items-center pt-8 space-x-2"><Checkbox id="is_active" name="is_active" checked={definition.is_active} onCheckedChange={(checked) => setDefinition(prev => ({ ...prev, is_active: Boolean(checked) }))} /><Label htmlFor="is_active">Active</Label><p className="text-xs text-gray-500 mt-1">Activates this version.</p></div>
              </div>

              {/* Structured Step Editor */}
              <div className="space-y-4 pt-6 border-t mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold">Steps Editor</h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddStep} className="flex items-center">
                    <PlusCircle className="h-4 w-4 mr-2" /> Add New Step
                  </Button>
                </div>
                {currentSteps.length === 0 && (<div className="text-center text-gray-500 py-4 border-2 border-dashed rounded-md"><p>No steps defined. Click "Add New Step" to begin.</p></div>)}
                <div className="space-y-6">
                {currentSteps.map((step, index) => (
                  <StepConfigurator
                    key={`${step.name}-${index}`} // Consider a more stable unique ID if available on steps
                    step={step}
                    allStepNames={currentSteps.map(s => s.name)}
                    onStepChange={(updatedStep) => {
                      const newSteps = [...currentSteps];
                      newSteps[index] = updatedStep;
                      updateStepsInDefinition(newSteps);
                    }}
                    onDeleteStep={() => {
                      updateStepsInDefinition(currentSteps.filter((_, i) => i !== index));
                    }}
                  />
                ))}
                </div>
              </div>

              {/* Definition JSON Field (Raw Editor) */}
              <div className="pt-6 border-t mt-6">
                <Label htmlFor="definition_json_raw" className="text-lg font-semibold">Raw Definition JSON (Advanced)</Label>
                <Textarea id="definition_json_raw" value={definitionJsonString} onChange={(e) => handleDefinitionJsonChange(e.target.value)} rows={15} className="mt-1 font-mono text-sm"/>
                <p className="text-xs text-gray-500 mt-1">Manual JSON editing. Changes sync with the structured editor above if valid.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={saving || loading || !!formError} className="banking-gradient text-white">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : (isEditMode ? 'Save Changes' : (isCreateNewVersionMode ? 'Create New Version' : 'Create Workflow'))}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default WorkflowDefinitionEditPage;
