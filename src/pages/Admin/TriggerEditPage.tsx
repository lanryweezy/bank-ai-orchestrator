import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowTrigger, TriggerInput, ScheduledConfig, WebhookConfig } from '@/services/triggerService'; // Assuming types are exported from service
import { WorkflowDefinition } from '@/types/workflows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const isValidJsonString = (str: string) => {
  if (!str.trim()) return true; // Allow empty for optional payloads
  try { JSON.parse(str); } catch (e) { return false; }
  return true;
};

const TriggerEditPage: React.FC = () => {
  const { triggerId } = useParams<{ triggerId?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(triggerId);

  const [pageTitle, setPageTitle] = useState<string>('Workflow Trigger');
  const [trigger, setTrigger] = useState<Partial<TriggerInput>>({
    name: '',
    description: '',
    workflow_id: '',
    type: 'scheduled',
    configuration_json: { cron_string: '0 * * * *', timezone: 'UTC' } as ScheduledConfig, // Default to scheduled
    is_enabled: true,
  });
  const [configJsonString, setConfigJsonString] = useState<string>(JSON.stringify({ cron_string: '0 * * * *', timezone: 'UTC' }, null, 2));

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      // Fetch only active, latest versions for selection
      const data = await apiClient<WorkflowDefinition[]>('/admin/workflows?onlyActive=true');
      setWorkflows(data || []);
    } catch (err) {
      console.error("Failed to fetch workflows for trigger association", err);
      setError("Could not load available workflows.");
    }
  }, []);

  const fetchTriggerDetails = useCallback(async () => {
    if (isEditMode && triggerId) {
      try {
        const data = await apiClient<WorkflowTrigger>(`/admin/triggers/${triggerId}`);
        setTrigger({
          name: data.name,
          description: data.description || '',
          workflow_id: data.workflow_id,
          type: data.type as 'scheduled' | 'webhook', // Add more if triggerService supports
          configuration_json: data.configuration_json,
          is_enabled: data.is_enabled,
        });
        setConfigJsonString(JSON.stringify(data.configuration_json, null, 2));
        setPageTitle(`Edit Trigger: ${data.name}`);
      } catch (err: any) {
        setError(err.data?.message || err.message || 'Failed to fetch trigger details.');
      }
    } else {
      setPageTitle('Create New Trigger');
      // Initialize default config based on selected type
      if (trigger.type === 'scheduled') {
        setConfigJsonString(JSON.stringify({ cron_string: '0 * * * *', timezone: 'UTC', default_payload: {} }, null, 2));
      } else if (trigger.type === 'webhook') {
        setConfigJsonString(JSON.stringify({ path_identifier: '', method: 'POST', security: {type: 'none'}, payload_mapping_jq: '.' }, null, 2));
      }
    }
  }, [triggerId, isEditMode, trigger.type]); // trigger.type dependency for default config on new

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWorkflows(), fetchTriggerDetails()]).finally(() => setLoading(false));
  }, [fetchWorkflows, fetchTriggerDetails]);


  const handleInputChange = (field: keyof TriggerInput, value: any) => {
    setTrigger(prev => ({ ...prev, [field]: value }));
    if (field === 'type') { // Reset config when type changes
        if (value === 'scheduled') {
            const defaultConfig = { cron_string: '0 * * * *', timezone: 'UTC', default_payload: {} };
            setTrigger(prev => ({...prev, configuration_json: defaultConfig as ScheduledConfig }));
            setConfigJsonString(JSON.stringify(defaultConfig, null, 2));
        } else if (value === 'webhook') {
            const defaultConfig = { path_identifier: `hook${Date.now().toString().slice(-5)}`, method: 'POST', security: {type: 'none'}, payload_mapping_jq: '.' };
            setTrigger(prev => ({...prev, configuration_json: defaultConfig as WebhookConfig }));
            setConfigJsonString(JSON.stringify(defaultConfig, null, 2));
        }
        // Add other types if necessary
    }
  };

  const handleConfigJsonChange = (value: string) => {
    setConfigJsonString(value);
    if (isValidJsonString(value)) {
      setTrigger(prev => ({ ...prev, configuration_json: value.trim() ? JSON.parse(value) : {} }));
      setFormError(null);
    } else {
      setFormError('Configuration JSON is not valid JSON.');
    }
  };

  const renderConfigFields = () => {
    const currentConfig = (typeof trigger.configuration_json === 'object' && trigger.configuration_json !== null)
                          ? trigger.configuration_json
                          : {};

    const handleSpecificConfigChange = (field: string, value: any, subField?: string) => {
        let newConfigJson = { ...currentConfig };
        if (subField && typeof newConfigJson[field] === 'object' && newConfigJson[field] !== null) {
            (newConfigJson as any)[field] = { ...(newConfigJson as any)[field], [subField]: value };
        } else {
            (newConfigJson as any)[field] = value;
        }
        setTrigger(prev => ({ ...prev, configuration_json: newConfigJson }));
        setConfigJsonString(JSON.stringify(newConfigJson, null, 2));
    };

    if (trigger.type === 'scheduled') {
      const scheduledConfig = currentConfig as Partial<ScheduledConfig>;
      return (
        <div className="space-y-3 p-3 border rounded-md bg-slate-50">
          <h4 className="text-sm font-medium text-gray-700">Scheduled Config</h4>
          <div><Label htmlFor="cron_string" className="text-xs">Cron String</Label><Input id="cron_string" value={scheduledConfig.cron_string || ''} onChange={(e) => handleSpecificConfigChange('cron_string', e.target.value)} placeholder="e.g., 0 * * * *" className="h-8 text-xs"/></div>
          <div><Label htmlFor="timezone" className="text-xs">Timezone</Label><Input id="timezone" value={scheduledConfig.timezone || 'UTC'} onChange={(e) => handleSpecificConfigChange('timezone', e.target.value)} placeholder="e.g., America/New_York" className="h-8 text-xs"/></div>
          <div><Label htmlFor="default_payload" className="text-xs">Default Payload (JSON)</Label><Textarea id="default_payload" value={JSON.stringify(scheduledConfig.default_payload || {}, null, 2)} onChange={(e) => handleSpecificConfigChange('default_payload', isValidJsonString(e.target.value) ? JSON.parse(e.target.value) : {})} rows={3} className="font-mono text-xs"/></div>
        </div>
      );
    } else if (trigger.type === 'webhook') {
      const webhookConfig = currentConfig as Partial<WebhookConfig>;
      const securityConf = webhookConfig.security || {type: 'none'};
      return (
        <div className="space-y-3 p-3 border rounded-md bg-slate-50">
          <h4 className="text-sm font-medium text-gray-700">Webhook Config</h4>
          <div><Label htmlFor="path_identifier" className="text-xs">Path Identifier</Label><Input id="path_identifier" value={webhookConfig.path_identifier || ''} onChange={(e) => handleSpecificConfigChange('path_identifier', e.target.value)} placeholder="unique-webhook-path" className="h-8 text-xs"/></div>
          <div>
            <Label htmlFor="webhook-method" className="text-xs">HTTP Method</Label>
            <Select value={webhookConfig.method || 'POST'} onValueChange={(val) => handleSpecificConfigChange('method', val as WebhookConfig['method'])}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="POST" className="text-xs">POST</SelectItem><SelectItem value="GET" className="text-xs">GET</SelectItem><SelectItem value="PUT" className="text-xs">PUT</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="border p-2 rounded-md space-y-2">
            <Label className="text-xs font-medium">Security</Label>
            <Select value={securityConf.type || 'none'} onValueChange={(val) => handleSpecificConfigChange('security', {...securityConf, type: val as WebhookConfig['security']['type'] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none" className="text-xs">None</SelectItem><SelectItem value="hmac_sha256" className="text-xs">HMAC SHA256</SelectItem><SelectItem value="bearer_token" className="text-xs">Bearer Token</SelectItem></SelectContent>
            </Select>
            {(securityConf.type === 'hmac_sha256' || securityConf.type === 'bearer_token') && (
                 <div><Label htmlFor="secret_env_var" className="text-xs">Secret Env Var Name</Label><Input id="secret_env_var" value={securityConf.secret_env_var || ''} onChange={(e) => handleSpecificConfigChange('security', {...securityConf, secret_env_var: e.target.value})} placeholder="YOUR_WEBHOOK_SECRET_ENV_VAR" className="h-8 text-xs"/></div>
            )}
            {securityConf.type === 'hmac_sha256' && (
                 <div><Label htmlFor="header_name" className="text-xs">HMAC Header Name</Label><Input id="header_name" value={securityConf.header_name || 'X-Signature-256'} onChange={(e) => handleSpecificConfigChange('security', {...securityConf, header_name: e.target.value})} className="h-8 text-xs"/></div>
            )}
             {securityConf.type === 'bearer_token' && (
                 <div><Label htmlFor="header_name_bearer" className="text-xs">Bearer Token Header Name</Label><Input id="header_name_bearer" value={securityConf.header_name || 'Authorization'} onChange={(e) => handleSpecificConfigChange('security', {...securityConf, header_name: e.target.value})} className="h-8 text-xs"/></div>
            )}
          </div>
          <div><Label htmlFor="payload_mapping_jq" className="text-xs">Payload JQ Mapping (Optional)</Label><Textarea id="payload_mapping_jq" value={webhookConfig.payload_mapping_jq || '.'} onChange={(e) => handleSpecificConfigChange('payload_mapping_jq', e.target.value)} rows={2} className="font-mono text-xs" placeholder="e.g., .body or ."/></div>
        </div>
      );
    }
    // Fallback for 'event_bus' or other types to use raw JSON editor
    return (
      <div>
        <Label htmlFor="config_json_raw">Configuration JSON (Raw)</Label>
        <Textarea id="config_json_raw" value={configJsonString} onChange={(e) => handleConfigJsonChange(e.target.value)} rows={8} className="font-mono text-sm mt-1"/>
        <p className="text-xs text-gray-500 mt-1">Edit the raw JSON configuration for this trigger type.</p>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError(null); setFormError(null);

    if (!trigger.name || !trigger.workflow_id || !trigger.type) {
        setFormError("Name, Workflow, and Type are required.");
        setSaving(false); return;
    }
    if (!isValidJsonString(configJsonString)) {
        setFormError("Configuration JSON is invalid.");
        setSaving(false); return;
    }
    const finalConfigJson = configJsonString.trim() ? JSON.parse(configJsonString) : {};

    const payload: Partial<TriggerInput> = {
      name: trigger.name,
      description: trigger.description,
      workflow_id: trigger.workflow_id,
      type: trigger.type,
      configuration_json: finalConfigJson,
      is_enabled: trigger.is_enabled,
    };

    try {
      if (isEditMode && triggerId) {
        await apiClient<WorkflowTrigger>(`/admin/triggers/${triggerId}`, { method: 'PUT', data: payload });
        setError("Trigger updated successfully!"); // Using setError for success message temporarily
      } else {
        // For create, created_by_user_id will be set by backend via middleware
        const newTrigger = await apiClient<WorkflowTrigger>('/admin/triggers', { method: 'POST', data: payload });
        setError(`Trigger "${newTrigger.name}" created successfully!`); // Using setError for success
        setTimeout(() => navigate(`/admin/triggers/edit/${newTrigger.trigger_id}`), 1500);
      }
    } catch (err: any) {
      console.error('Failed to save trigger:', err);
      const apiError = err.data?.message || err.message || 'Failed to save trigger.';
      setError(apiError);
      if (err.data?.errors) {
        setFormError(`Validation failed: ${err.data.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) { /* ... skeleton ... */ }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/triggers')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Triggers List
        </Button>
        <Card className="max-w-2xl mx-auto">
          <CardHeader> <CardTitle className="text-2xl">{pageTitle}</CardTitle> <CardDescription>Configure trigger details.</CardDescription> </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (<Alert variant={error.includes("Success") ? "default" : "destructive"} className={error.includes("Success") ? "bg-green-50 border-green-400 text-green-700":""}><AlertTriangle className="h-4 w-4" /><AlertTitle>{error.includes("Success") ? "Success" : "Error"}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              {formError && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Validation Error</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert>)}

              <div><Label htmlFor="name">Trigger Name</Label><Input id="name" value={trigger.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} required /></div>
              <div><Label htmlFor="description">Description</Label><Textarea id="description" value={trigger.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} rows={2}/></div>
              <div>
                <Label htmlFor="workflow_id">Workflow To Trigger</Label>
                <Select value={trigger.workflow_id} onValueChange={(val) => handleInputChange('workflow_id', val)} required>
                  <SelectTrigger><SelectValue placeholder="Select a workflow" /></SelectTrigger>
                  <SelectContent> {workflows.map(wf => (<SelectItem key={wf.workflow_id} value={wf.workflow_id}> {wf.name} (v{wf.version}) </SelectItem>))} </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Trigger Type</Label>
                <Select value={trigger.type} onValueChange={(val) => handleInputChange('type', val as TriggerInput['type'])} required>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled (Cron)</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    {/* <SelectItem value="event_bus" disabled>Event Bus (Coming Soon)</SelectItem> */}
                  </SelectContent>
                </Select>
              </div>
              {renderConfigFields()}
              <div className="flex items-center space-x-2"><Checkbox id="is_enabled" checked={trigger.is_enabled} onCheckedChange={(val) => handleInputChange('is_enabled', Boolean(val))} /><Label htmlFor="is_enabled">Enabled</Label></div>
            </CardContent>
            <CardFooter> <Button type="submit" disabled={saving || loading} className="banking-gradient text-white"> <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Trigger'} </Button> </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};
export default TriggerEditPage;
