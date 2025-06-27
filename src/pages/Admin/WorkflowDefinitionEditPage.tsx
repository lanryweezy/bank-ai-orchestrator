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
  const { workflowId, workflowName: workflowNameFromRoute } = useParams<{ workflowId?: string; workflowName?: string }>();
  const navigate = useNavigate();

  // Determine mode based on URL parameters
  let determinedMode: 'create_new' | 'create_version' | 'edit_version' = 'create_new';
  if (workflowId) {
    determinedMode = 'edit_version';
  } else if (workflowNameFromRoute) {
    determinedMode = 'create_version';
  }

  const [mode, setMode] = useState<'create_new' | 'create_version' | 'edit_version'>(determinedMode);
  const [pageTitle, setPageTitle] = useState<string>('Create New Workflow Definition');

  const [originalName, setOriginalName] = useState<string>(workflowNameFromRoute || '');

  const [definition, setDefinition] = useState<WorkflowDefinitionInput>({
    name: workflowNameFromRoute || '', // Pre-fill name if creating new version
    description: '',
    definition_json: {},
    version: 1,
    is_active: true,
  });
  const [definitionJsonString, setDefinitionJsonString] = useState<string>('{}');

  const [loading, setLoading] = useState<boolean>(true); // Start true to load data
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const defaultJsonStructure = '{\n  "description": "My new workflow version",\n  "start_step": "initial_step",\n  "steps": [\n    {\n      "name": "initial_step",\n      "type": "human_review",\n      "assigned_role": "user",\n      "form_schema": { "type": "object", "properties": { "comments": {"type": "string"} } },\n      "transitions": []\n    }\n  ]\n}';

  const fetchLatestVersionForName = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const versions = await apiClient<WorkflowDefinition[]>(`/admin/workflows/name/${name}/versions`);
      if (versions && versions.length > 0) {
        const latestVersion = versions.sort((a,b) => b.version - a.version)[0]; // already sorted by service, but good practice
        setDefinition(prev => ({
          ...prev,
          name: latestVersion.name,
          description: latestVersion.description || '',
          definition_json: latestVersion.definition_json || {},
          is_active: true, // New versions default to active
          version: (latestVersion.version || 0) + 1 // For display only, backend determines actual
        }));
        setDefinitionJsonString(JSON.stringify(latestVersion.definition_json || {}, null, 2));
        setOriginalName(latestVersion.name);
        setPageTitle(`Create New Version for: ${latestVersion.name}`);
      } else {
        setError(`No existing workflow found named "${name}" to base a new version on. Please create it as a new workflow first.`);
        setDefinition(prev => ({...prev, name: name, version: 1}));
        setOriginalName(name);
        setDefinitionJsonString(defaultJsonStructure);
        setPageTitle(`Create New Version for: ${name} (will be v1)`);
      }
    } catch (err:any) {
      setError(err.data?.message || err.message || `Failed to fetch latest version for ${name}.`);
    } finally {
      setLoading(false);
    }
  }, []);


  const fetchDefinitionById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<WorkflowDefinition>(`/admin/workflows/${id}`);
      setDefinition({
        name: data.name,
        description: data.description || '',
        definition_json: data.definition_json || {},
        version: data.version,
        is_active: data.is_active,
      });
      setDefinitionJsonString(JSON.stringify(data.definition_json || {}, null, 2));
      setOriginalName(data.name);
      setPageTitle(`Edit Workflow: ${data.name} (v${data.version})`);
    } catch (err: any) {
      console.error('Failed to fetch workflow definition:', err);
      setError(err.data?.message || err.message || 'Failed to fetch workflow definition details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // This effect runs once on component mount due to determinedMode
    if (determinedMode === 'edit_version' && workflowId) {
      fetchDefinitionById(workflowId);
    } else if (determinedMode === 'create_version' && workflowNameFromRoute) {
      fetchLatestVersionForName(workflowNameFromRoute);
    } else { // 'create_new'
      setDefinition({ name: '', description: '', definition_json: {}, version: 1, is_active: true });
      setDefinitionJsonString(defaultJsonStructure);
      setOriginalName('');
      setPageTitle('Create New Workflow Definition');
      setLoading(false); // Not fetching anything for create_new
    }
  }, [determinedMode, workflowId, workflowNameFromRoute, fetchDefinitionById, fetchLatestVersionForName]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setDefinition(prev => ({ ...prev, [name]: checked }));
    } else {
        // Name and Version are read-only in edit_version and create_version modes after initial load
        if ((mode === 'edit_version' || mode === 'create_version') && (name === 'name' || name === 'version')) {
            return;
        }
        setDefinition(prev => ({ ...prev, [name]: value }));
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
      if (mode === 'edit_version' && workflowId) {
        const payload: Partial<WorkflowDefinitionInput> = {
          description: definition.description,
          definition_json: currentJson,
          is_active: definition.is_active,
        };
        const updatedDef = await apiClient<WorkflowDefinition>(`/admin/workflows/${workflowId}`, {
          method: 'PUT',
          data: payload,
        });
        setSuccessMessage(`Workflow "${updatedDef.name}" (v${updatedDef.version}) updated successfully!`);
      } else if (mode === 'create_version' && originalName) {
        const payload: Partial<WorkflowDefinitionInput> = {
          description: definition.description,
          definition_json: currentJson,
          is_active: definition.is_active, // New versions default to active
        };
        const newVersion = await apiClient<WorkflowDefinition>(`/admin/workflows/name/${originalName}/versions`, {
          method: 'POST',
          data: payload,
        });
        setSuccessMessage(`New version (v${newVersion.version}) for workflow "${newVersion.name}" created successfully!`);
        setTimeout(() => navigate(`/admin/workflow-definitions/edit/${newVersion.workflow_id}`), 1500);

      } else { // mode === 'create_new'
         const payload: WorkflowDefinitionInput = {
            name: definition.name,
            description: definition.description,
            definition_json: currentJson,
            version: 1, // First version is always 1
            is_active: definition.is_active,
        };
        const newDef = await apiClient<WorkflowDefinition>('/admin/workflows', {
          method: 'POST',
          data: payload,
        });
        setSuccessMessage(`Workflow "${newDef.name}" (v1) created successfully!`);
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

  if (loading) { // Combined loading check for all fetch scenarios
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
              {mode === 'edit_version' && `Editing details for version ${definition.version} of workflow "${originalName}". Name and version number are fixed for this specific record.`}
              {mode === 'create_version' && `Creating a new version for workflow "${originalName}". The new version number will be automatically assigned.`}
              {mode === 'create_new' && 'Define a new workflow name and its first version.'}
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
                  disabled={mode === 'edit_version' || mode === 'create_version'} // Name is read-only if editing or creating new version for existing name
                />
                {(mode === 'edit_version' || mode === 'create_version') && (
                  <p className="text-xs text-gray-500 mt-1">Workflow name cannot be changed when editing or creating a new version.</p>
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
                        disabled={mode === 'edit_version' || mode === 'create_version'} // Version is read-only if editing or creating new version
                    />
                    {mode === 'create_new' && <p className="text-xs text-gray-500 mt-1">Set to 1 for the first version. Name & Version combination must be unique.</p>}
                    {mode === 'create_version' && <p className="text-xs text-gray-500 mt-1">New version number will be auto-assigned by the system.</p>}
                    {mode === 'edit_version' && <p className="text-xs text-gray-500 mt-1">Version number is fixed for this record.</p>}
                </div>
                <div className="flex items-center pt-8 space-x-2">
                    <Checkbox id="is_active" name="is_active" checked={definition.is_active} onCheckedChange={(checked) => setDefinition(prev => ({ ...prev, is_active: Boolean(checked) }))} />
                    <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
                    <p className="text-xs text-gray-500">(Only one version of a workflow name can be active)</p>
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
                {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Definition')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default WorkflowDefinitionEditPage;
