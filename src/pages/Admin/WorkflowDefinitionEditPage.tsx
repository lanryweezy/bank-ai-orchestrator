import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowDefinition, WorkflowDefinitionInput } from '@/types/workflows'; // Ensure this type allows optional workflow_id for creation
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Save, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Basic JSON validation helper (can be improved)
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

  const isEditMode = Boolean(workflowId); // Editing a specific version
  const isCreateNewVersionMode = Boolean(baseWorkflowName); // Creating a new version for an existing name
  const isCreateBrandNewMode = !isEditMode && !isCreateNewVersionMode; // Creating a brand new workflow name

  const [pageTitle, setPageTitle] = useState<string>('Workflow Definition');

  const [definition, setDefinition] = useState<WorkflowDefinitionInput>({
    name: baseWorkflowName || '',
    description: '',
    definition_json: {},
    version: 1, // This will be informative in UI, actual version set by backend for new versions
    is_active: true,
  });
  const [definitionJsonString, setDefinitionJsonString] = useState<string>('{}');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const defaultJsonStructure = '{\n  "description": "My new workflow version",\n  "start_step": "initial_step",\n  "steps": [\n    {\n      "name": "initial_step",\n      "type": "human_review",\n      "assigned_role": "user",\n      "form_schema": { "type": "object", "properties": { "comments": {"type": "string"} } },\n      "transitions": []\n    }\n  ]\n}';

  const fetchWorkflowDetails = useCallback(async () => {
    if (isEditMode && workflowId) {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient<WorkflowDefinition>(`/admin/workflows/${workflowId}`);
        setDefinition({
          name: data.name,
          description: data.description || '',
          definition_json: data.definition_json || {},
          version: data.version,
          is_active: data.is_active,
        });
        setDefinitionJsonString(JSON.stringify(data.definition_json || {}, null, 2));
        setPageTitle(`Edit Workflow: ${data.name} (v${data.version})`);
      } catch (err: any) {
        setError(err.data?.message || err.message || 'Failed to fetch workflow definition details.');
      } finally {
        setLoading(false);
      }
    } else if (isCreateNewVersionMode && baseWorkflowName) {
      // Fetch the latest version of `baseWorkflowName` to prefill description and definition_json
      // The backend service `createNewWorkflowVersionFromLatest` will handle setting the new version number.
      setLoading(true);
      setError(null);
      try {
        // This endpoint needs to exist: GET /admin/workflows/name/:name/latest
        // For now, we'll assume it returns the latest version (active or not for prefill)
        // Or, use the existing getAllWorkflowVersionsByName and pick the latest.
        const versions = await apiClient<WorkflowDefinition[]>(`/admin/workflows/name/${baseWorkflowName}/versions`);
        if (versions && versions.length > 0) {
          const latestVersion = versions[0]; // Assuming sorted by version desc
          setDefinition(prev => ({
            ...prev,
            name: latestVersion.name, // Name is fixed
            description: latestVersion.description || '',
            definition_json: latestVersion.definition_json || {},
            is_active: true, // New versions default to active
            version: (latestVersion.version || 0) + 1 // Informational, backend sets actual
          }));
          setDefinitionJsonString(JSON.stringify(latestVersion.definition_json || {}, null, 2));
          setPageTitle(`Create New Version for: ${latestVersion.name}`);
        } else {
           // If no workflow with that name exists, treat as creating a new v1 for that name
          setDefinition(prev => ({...prev, name: baseWorkflowName, version: 1, is_active: true}));
          setDefinitionJsonString(defaultJsonStructure);
          setPageTitle(`Create Workflow: ${baseWorkflowName} (v1)`);
        }
      } catch (err: any) {
         setError(err.data?.message || err.message || `Failed to fetch base workflow details for ${baseWorkflowName}.`);
         // Fallback to creating a new workflow with this name
         setDefinition(prev => ({...prev, name: baseWorkflowName, version: 1, is_active: true}));
         setDefinitionJsonString(defaultJsonStructure);
         setPageTitle(`Create Workflow: ${baseWorkflowName} (v1)`);
      } finally {
        setLoading(false);
      }
    } else { // Create Brand New Mode
      setDefinition({ name: '', description: '', definition_json: {}, version: 1, is_active: true });
      setDefinitionJsonString(defaultJsonStructure);
      setPageTitle('Create New Workflow Definition');
      setLoading(false);
    }
  }, [workflowId, baseWorkflowName, isEditMode, isCreateNewVersionMode, defaultJsonStructure]);

  useEffect(() => {
    fetchWorkflowDetails();
  }, [fetchWorkflowDetails]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setDefinition(prev => ({ ...prev, [name]: checked }));
    } else {
        // In edit mode or create new version mode, 'name' and 'version' are read-only after initial load
        if ((isEditMode || isCreateNewVersionMode) && (name === 'name' || name === 'version')) {
            return;
        }
        setDefinition(prev => ({ ...prev, [name]: name === 'version' ? (value === '' ? undefined : Number(value)) : value }));
    }
  };

  const handleDefinitionJsonChange = (value: string) => {
    setDefinitionJsonString(value);
    if (isValidJson(value)) {
      setDefinition(prev => ({ ...prev, definition_json: JSON.parse(value) }));
      if (formError && formError.includes("Definition JSON")) setFormError(null);
    } else {
      setFormError('Definition JSON is not valid JSON. Please correct it.');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setFormError(null);

    if (!isValidJson(definitionJsonString)) {
      setFormError('Definition JSON is not valid JSON. Please correct it before saving.');
      setSaving(false);
      return;
    }

    const currentJson = JSON.parse(definitionJsonString);

    try {
      if (isEditMode && workflowId) {
        // Update existing specific version
        const payload: Partial<WorkflowDefinitionInput> = {
          description: definition.description,
          definition_json: currentJson,
          is_active: definition.is_active,
          // Name and version are not changed here as per service logic
        };
        const updatedDef = await apiClient<WorkflowDefinition>(`/admin/workflows/${workflowId}`, {
          method: 'PUT',
          data: payload,
        });
        setSuccessMessage(`Workflow "${updatedDef.name}" (v${updatedDef.version}) updated successfully!`);
      } else if (isCreateNewVersionMode && baseWorkflowName) {
        // Create a new version for an existing name
        // The backend route POST /admin/workflows/name/:name/versions would handle this
        // It would internally call createNewWorkflowVersionFromLatest or similar service
        const payload = { // Data for the NEW version
          description: definition.description,
          definition_json: currentJson,
          is_active: definition.is_active,
        };
        // This API endpoint needs to be created: POST /admin/workflows/name/:baseWorkflowName/versions
        // For now, let's simulate by calling the general create endpoint, assuming backend handles versioning.
        // OR, adapt the current create endpoint if it can handle "create new version" logic.
        // The backend createWorkflowDefinition if is_active=true, will deactivate others of same name.
        // It will take the version from payload or default to 1.
        // This is not ideal for "create new version" which implies incrementing.
        // **Using a placeholder for a dedicated "create new version" API call for now**
        // For this iteration, we'll call the standard POST /admin/workflows, and the admin must manage version numbers carefully.
        // This is a simplification due to lack of a dedicated "create new version" backend route in this step.
         const newVersionPayload: WorkflowDefinitionInput = {
            name: baseWorkflowName, // Fixed name
            description: definition.description,
            definition_json: currentJson,
            version: definition.version, // User suggests next version, backend validates uniqueness
            is_active: definition.is_active,
        };
        const newVersion = await apiClient<WorkflowDefinition>(`/admin/workflows`, { // Using general create
          method: 'POST',
          data: newVersionPayload,
        });
        setSuccessMessage(`New version (v${newVersion.version}) for workflow "${newVersion.name}" created successfully!`);
        setTimeout(() => navigate(`/admin/workflow-definitions/edit/${newVersion.workflow_id}`), 1500);

      } else { // Create Brand New Workflow (isCreateBrandNewMode)
         const payload: WorkflowDefinitionInput = {
            name: definition.name,
            description: definition.description,
            definition_json: currentJson,
            version: Number(definition.version) || 1, // Ensure version is a number, default to 1
            is_active: definition.is_active,
        };
        const newDef = await apiClient<WorkflowDefinition>('/admin/workflows', {
          method: 'POST',
          data: payload,
        });
        setSuccessMessage(`Workflow "${newDef.name}" (v${newDef.version || 1}) created successfully!`);
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

  if (loading) {
     return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-6 w-3/4 mb-6" />
          <Card><CardHeader><Skeleton className="h-7 w-1/4" /></CardHeader>
            <CardContent className="space-y-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2"><Skeleton className="h-4 w-1/5" /><Skeleton className="h-10 w-full" /></div>
              ))}
              <Skeleton className="h-32 w-full" /> <Skeleton className="h-10 w-1/5 mt-2" />
            </CardContent>
            <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
          </Card>
        </div>
      </Layout>
    );
  }

  if (error && (error.includes('Forbidden') || error.includes('Unauthorized'))) {
    return (
      <Layout>
        <div className="p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
          <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have the necessary permissions to perform this action.
              <p className="mt-2 text-xs">{error}</p>
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => navigate('/admin/workflow-definitions')} className="mt-6">
            Back to Definitions List
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/workflow-definitions')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Definitions List
        </Button>

        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">{pageTitle}</CardTitle>
            <CardDescription>
              {isEditMode && `Editing details for version ${definition.version} of workflow "${definition.name}". Name and version number are fixed for this specific record.`}
              {isCreateNewVersionMode && `Creating a new version for workflow "${baseWorkflowName}". The new version number will be auto-suggested or set by the backend.`}
              {isCreateBrandNewMode && 'Define a new workflow name and its first version.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Error and Success Messages */}
              {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {formError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              {successMessage && (
                <Alert variant="default" className="bg-green-50 border-green-400 text-green-700">
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}

              {/* Workflow Name Field */}
              <div>
                <Label htmlFor="name">Workflow Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={definition.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Loan Application Processing"
                  required
                  className="mt-1"
                  disabled={isEditMode || isCreateNewVersionMode}
                />
                {(isEditMode || isCreateNewVersionMode) && (
                  <p className="text-xs text-gray-500 mt-1">Workflow name is fixed when editing or creating a new version.</p>
                )}
              </div>

              {/* Description Field */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" value={definition.description} onChange={handleInputChange} placeholder="A brief description of this workflow version." rows={3} className="mt-1" />
              </div>

              {/* Version and Active Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="version">Version</Label>
                    <Input
                        id="version"
                        name="version"
                        type="number"
                        value={definition.version || ''}
                        onChange={handleInputChange}
                        placeholder="1"
                        required
                        min="1"
                        className="mt-1"
                        disabled={isEditMode || isCreateNewVersionMode}
                    />
                    {isCreateBrandNewMode && <p className="text-xs text-gray-500 mt-1">Set to 1 for the first version. Name & Version combination must be unique.</p>}
                    {isCreateNewVersionMode && <p className="text-xs text-gray-500 mt-1">New version number will be auto-suggested by the system (e.g., incremented from latest).</p>}
                    {isEditMode && <p className="text-xs text-gray-500 mt-1">Version number is fixed for this specific record.</p>}
                </div>
                <div className="flex items-center pt-8 space-x-2">
                    <Checkbox id="is_active" name="is_active" checked={definition.is_active} onCheckedChange={(checked) => setDefinition(prev => ({ ...prev, is_active: Boolean(checked) }))} />
                    <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
                    <p className="text-xs text-gray-500 mt-1">Activating this version will deactivate other versions of the same workflow name.</p>
                </div>
              </div>

              {/* Definition JSON Field */}
              <div>
                <Label htmlFor="definition_json">Definition JSON</Label>
                <Textarea
                  id="definition_json"
                  name="definition_json"
                  value={definitionJsonString}
                  onChange={(e) => handleDefinitionJsonChange(e.target.value)}
                  placeholder='{ "start_step": "step1", "steps": [ ... ] }'
                  rows={15}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">The JSON structure defining the workflow steps, transitions, and logic.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={saving || loading} className="banking-gradient text-white">
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
