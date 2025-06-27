import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { AgentTemplate, AgentTemplateInput } from '@/types/agentTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
// For a better JSON editing experience, consider a dedicated JSON editor component
// import AceEditor from 'react-ace';
// import 'ace-builds/src-noconflict/mode-json';
// import 'ace-builds/src-noconflict/theme-github';

const AgentTemplateEditPage: React.FC = () => {
  const { templateId } = useParams<{ templateId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(templateId);

  const [template, setTemplate] = useState<AgentTemplateInput>({
    name: '',
    description: '',
    core_logic_identifier: '',
    configurable_params_json_schema: {},
  });
  const [jsonSchemaString, setJsonSchemaString] = useState<string>('{}');

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    if (isEditing && templateId) {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient<AgentTemplate>(`/admin/agent-templates/${templateId}`);
        setTemplate({
            name: data.name,
            description: data.description || '',
            core_logic_identifier: data.core_logic_identifier,
            configurable_params_json_schema: data.configurable_params_json_schema || {},
        });
        setJsonSchemaString(JSON.stringify(data.configurable_params_json_schema || {}, null, 2));
      } catch (err: any) {
        console.error('Failed to fetch agent template:', err);
        setError(err.data?.message || err.message || 'Failed to fetch template details.');
      } finally {
        setLoading(false);
      }
    }
  }, [templateId, isEditing]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => ({ ...prev, [name]: value }));
  };

  const handleJsonSchemaChange = (value: string) => {
    setJsonSchemaString(value);
    try {
      const parsedJson = JSON.parse(value);
      setTemplate(prev => ({ ...prev, configurable_params_json_schema: parsedJson }));
      setFormError(null); // Clear error if JSON is valid
    } catch (e) {
      // Display an error message to the user if JSON is invalid
      setFormError('Invalid JSON format for Configurable Parameters Schema.');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setFormError(null);

    let parsedSchema;
    try {
      parsedSchema = JSON.parse(jsonSchemaString);
    } catch (jsonError) {
      setFormError('Configurable Parameters Schema is not valid JSON. Please correct it.');
      setSaving(false);
      return;
    }

    const payload: AgentTemplateInput = {
      ...template,
      configurable_params_json_schema: parsedSchema,
    };

    try {
      if (isEditing && templateId) {
        const updatedTemplate = await apiClient<AgentTemplate>(`/admin/agent-templates/${templateId}`, {
          method: 'PUT',
          data: payload,
        });
        setSuccessMessage(`Agent template "${updatedTemplate.name}" updated successfully!`);
      } else {
        const newTemplate = await apiClient<AgentTemplate>('/admin/agent-templates', {
          method: 'POST',
          data: payload,
        });
        setSuccessMessage(`Agent template "${newTemplate.name}" created successfully!`);
        if (!isEditing) { // If creating, navigate to edit page of the new template or list
             setTimeout(() => navigate(`/admin/agent-templates/edit/${newTemplate.template_id}`), 1500);
        }
      }
    } catch (err: any) {
      console.error('Failed to save agent template:', err);
      const apiError = err.data?.message || err.message || 'Failed to save agent template.';
      setError(apiError);
      if (err.data?.errors) { // Zod validation errors
        // Format Zod errors for display if needed, or just show main message
        const fieldErrors = err.data.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
        setFormError(`Validation failed: ${fieldErrors}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && isEditing) {
    return (
      <Layout>
        <div className="p-6">
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-6 w-3/4 mb-6" />
          <Card>
            <CardHeader><Skeleton className="h-7 w-1/4" /></CardHeader>
            <CardContent className="space-y-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-1/5" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/5" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
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
          <Button variant="outline" onClick={() => navigate('/admin/agent-templates')} className="mt-6">
            Back to Templates List
          </Button>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/agent-templates')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates List
        </Button>

        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">{isEditing ? 'Edit Agent Template' : 'Create New Agent Template'}</CardTitle>
            <CardDescription>
              {isEditing ? `Modify the details for template ID: ${templateId}` : 'Define a new agent template for the platform.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && (
                <Alert variant="destructive">
                  <AlertTitle>Save Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {formError && (
                <Alert variant="destructive">
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

              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={template.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Document Summarizer Agent"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={template.description}
                  onChange={handleInputChange}
                  placeholder="A brief description of what this agent template does."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="core_logic_identifier">Core Logic Identifier</Label>
                <Input
                  id="core_logic_identifier"
                  name="core_logic_identifier"
                  value={template.core_logic_identifier}
                  onChange={handleInputChange}
                  placeholder="e.g., documentSummarizer_v1"
                  required
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  A unique identifier that the backend uses to invoke the correct agent logic.
                </p>
              </div>

              <div>
                <Label htmlFor="configurable_params_json_schema">Configurable Parameters (JSON Schema)</Label>
                <Textarea
                  id="configurable_params_json_schema"
                  name="configurable_params_json_schema"
                  value={jsonSchemaString}
                  onChange={(e) => handleJsonSchemaChange(e.target.value)}
                  placeholder='{ "type": "object", "properties": { "max_length": { "type": "number", "description": "Maximum summary length." } } }'
                  rows={10}
                  className="mt-1 font-mono text-sm"
                />
                 {/* Placeholder for AceEditor or similar */}
                 {/* <AceEditor
                    mode="json"
                    theme="github"
                    name="configurable_params_json_schema"
                    onChange={handleJsonSchemaChange}
                    value={jsonSchemaString}
                    fontSize={14}
                    showPrintMargin={true}
                    showGutter={true}
                    highlightActiveLine={true}
                    width="100%"
                    height="200px"
                    setOptions={{
                        useWorker: false, // Disables schema validation worker if causing issues
                        showLineNumbers: true,
                        tabSize: 2,
                    }}
                    className="mt-1 border rounded-md"
                /> */}
                <p className="text-xs text-gray-500 mt-1">
                  Define the JSON schema for parameters that users will configure when creating an agent from this template.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={saving || loading} className="banking-gradient text-white">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Template')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default AgentTemplateEditPage;
