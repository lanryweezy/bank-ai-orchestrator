import React from 'react';
import {
    WorkflowStepDefinition,
    BaseWorkflowStepDefinition,
    ExternalApiCallStepConfigType, // Import this type
    OnFailureActionType, // Import this type
    HumanTaskEscalationPolicyType // Import this type
} from '@/types/workflows';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StepConfiguratorProps {
  step: WorkflowStepDefinition;
  allStepNames: string[]; // For populating 'to' fields in transitions, join_on etc.
  onStepChange: (updatedStep: WorkflowStepDefinition) => void;
  onDeleteStep?: () => void; // Optional: if delete is handled here or parent
}

// Define available step types - should match BaseWorkflowStepDefinition['type']
// Explicitly listing them for the Select component
const stepTypes: BaseWorkflowStepDefinition['type'][] = [
  'human_review',
  'agent_execution',
  'decision',
  'parallel',
  'join',
  'end',
  'sub_workflow',
  'external_api_call',
  'data_input', // Make sure this is included if it's a valid type
];

// Define available final statuses for 'end' steps
const finalStatuses: NonNullable<BaseWorkflowStepDefinition['final_status']>[] = [
  'completed',
  'approved',
  'rejected',
];


const StepConfigurator: React.FC<StepConfiguratorProps> = ({ step, onStepChange, allStepNames, onDeleteStep }) => {

  const handleChange = (field: keyof WorkflowStepDefinition, value: any) => {
    onStepChange({ ...step, [field]: value });
  };

  const handleTypeChange = (newType: BaseWorkflowStepDefinition['type']) => {
    // When type changes, reset type-specific fields to avoid carrying over incompatible data
    const newStep: WorkflowStepDefinition = {
        name: step.name,
        type: newType,
        description: step.description,
        output_namespace: step.output_namespace,
        // Initialize transitions if not present, common for most steps
        transitions: step.transitions || []
    };
    // Add default structures for new type if necessary, e.g. error_handling
    onStepChange(newStep);
  };

  return (
    <Card className="mb-4 border-l-4 border-blue-500">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Step: {step.name}</CardTitle>
          {onDeleteStep && (
            <button type="button" onClick={onDeleteStep} className="text-red-500 hover:text-red-700 text-xs">
              Remove Step
            </button>
          )}
        </div>
        <CardDescription>Configure the details for this step.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor={`step-name-${step.name}`}>Name</Label>
          <Input
            id={`step-name-${step.name}`}
            value={step.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Unique step name"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`step-type-${step.name}`}>Type</Label>
          <Select value={step.type} onValueChange={(value) => handleTypeChange(value as BaseWorkflowStepDefinition['type'])}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Select step type" />
            </SelectTrigger>
            <SelectContent>
              {stepTypes.map(type => (
                <SelectItem key={type} value={type}>{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`step-description-${step.name}`}>Description</Label>
          <Textarea
            id={`step-description-${step.name}`}
            value={step.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Optional description for this step"
            rows={2}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`step-output_namespace-${step.name}`}>Output Namespace (Optional)</Label>
          <Input
            id={`step-output_namespace-${step.name}`}
            value={step.output_namespace || ''}
            onChange={(e) => handleChange('output_namespace', e.target.value || undefined)} // Store as undefined if empty
            placeholder="e.g., customerDetails, approvalResult"
            className="mt-1"
          />
           <p className="text-xs text-gray-500 mt-1">If provided, step output will be nested under this key in results_json.</p>
        </div>

        {/* Type-specific configurations will go here */}
        {step.type === 'agent_execution' && (
            <div>
                <Label htmlFor={`step-agent_core_logic_identifier-${step.name}`}>Agent Core Logic Identifier</Label>
                <Input
                    id={`step-agent_core_logic_identifier-${step.name}`}
                    value={step.agent_core_logic_identifier || ''}
                    onChange={(e) => handleChange('agent_core_logic_identifier', e.target.value)}
                    placeholder="e.g., loanCheckerAgent_v1"
                    className="mt-1 h-8 text-xs"
                />
            </div>
        )}

        {/* External API Call Config */}
        {step.type === 'external_api_call' && (
            <div className="p-3 border rounded-md bg-gray-50 space-y-3 mt-2">
                <h5 className="text-sm font-medium text-gray-700">External API Call Configuration</h5>
                <div>
                    <Label htmlFor={`extapi-url-${step.name}`} className="text-xs">URL Template</Label>
                    <Input id={`extapi-url-${step.name}`} value={step.external_api_call_config?.url_template || ''}
                           onChange={(e) => onStepChange({...step, external_api_call_config: {...step.external_api_call_config, url_template: e.target.value} as ExternalApiCallStepConfigType})}
                           className="h-8 text-xs" placeholder="https://api.example.com/data/{{context.id}}" />
                </div>
                <div>
                    <Label htmlFor={`extapi-method-${step.name}`} className="text-xs">Method</Label>
                    <Select
                        value={step.external_api_call_config?.method || 'GET'}
                        onValueChange={(val) => onStepChange({...step, external_api_call_config: {...step.external_api_call_config, method: val as ExternalApiCallStepConfigType['method']} as ExternalApiCallStepConfigType})}
                    >
                        <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {/* Headers Template */}
                <div className="mt-2">
                    <Label className="text-xs font-medium">Headers (Key-Value Pairs)</Label>
                    {(Object.entries(step.external_api_call_config?.headers_template || {})).map(([key, value], idx) => (
                        <div key={`header-${idx}`} className="flex items-center space-x-2 mt-1">
                            <Input type="text" value={key} placeholder="Header Name" className="h-8 text-xs flex-1"
                                   onChange={(e) => {
                                       const newHeaders = {...step.external_api_call_config?.headers_template};
                                       delete newHeaders[key]; // Remove old key
                                       newHeaders[e.target.value] = value; // Add new key
                                       onStepChange({...step, external_api_call_config: {...step.external_api_call_config, headers_template: newHeaders} as ExternalApiCallStepConfigType});
                                   }}/>
                            <Input type="text" value={value} placeholder="Header Value (can use {{templates}})" className="h-8 text-xs flex-1"
                                   onChange={(e) => onStepChange({...step, external_api_call_config: {...step.external_api_call_config, headers_template: {...step.external_api_call_config?.headers_template, [key]: e.target.value}} as ExternalApiCallStepConfigType})}/>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => {
                                const newHeaders = {...step.external_api_call_config?.headers_template};
                                delete newHeaders[key];
                                onStepChange({...step, external_api_call_config: {...step.external_api_call_config, headers_template: newHeaders} as ExternalApiCallStepConfigType});
                            }}><Trash2 size={14}/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="xs" className="mt-1 text-xs"
                            onClick={() => {
                                const newKey = `header${Object.keys(step.external_api_call_config?.headers_template || {}).length + 1}`;
                                onStepChange({...step, external_api_call_config: {...step.external_api_call_config, headers_template: {...step.external_api_call_config?.headers_template, [newKey]: ""}} as ExternalApiCallStepConfigType});
                            }}>+ Add Header</Button>
                </div>

                {/* Query Params Template */}
                <div className="mt-2">
                    <Label className="text-xs font-medium">Query Parameters (Key-Value Pairs)</Label>
                     {(Object.entries(step.external_api_call_config?.query_params_template || {})).map(([key, value], idx) => (
                        <div key={`query-${idx}`} className="flex items-center space-x-2 mt-1">
                            <Input type="text" value={key} placeholder="Param Name" className="h-8 text-xs flex-1"
                                   onChange={(e) => {
                                       const newParams = {...step.external_api_call_config?.query_params_template};
                                       delete newParams[key];
                                       newParams[e.target.value] = value;
                                       onStepChange({...step, external_api_call_config: {...step.external_api_call_config, query_params_template: newParams} as ExternalApiCallStepConfigType});
                                   }}/>
                            <Input type="text" value={value} placeholder="Param Value (can use {{templates}})" className="h-8 text-xs flex-1"
                                   onChange={(e) => onStepChange({...step, external_api_call_config: {...step.external_api_call_config, query_params_template: {...step.external_api_call_config?.query_params_template, [key]: e.target.value}} as ExternalApiCallStepConfigType})}/>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => {
                                const newParams = {...step.external_api_call_config?.query_params_template};
                                delete newParams[key];
                                onStepChange({...step, external_api_call_config: {...step.external_api_call_config, query_params_template: newParams} as ExternalApiCallStepConfigType});
                            }}><Trash2 size={14}/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="xs" className="mt-1 text-xs"
                            onClick={() => {
                                const newKey = `param${Object.keys(step.external_api_call_config?.query_params_template || {}).length + 1}`;
                                onStepChange({...step, external_api_call_config: {...step.external_api_call_config, query_params_template: {...step.external_api_call_config?.query_params_template, [newKey]: ""}} as ExternalApiCallStepConfigType});
                            }}>+ Add Query Param</Button>
                </div>

                {/* Body Template (Textarea for now, could be JSON editor) */}
                {['POST', 'PUT', 'PATCH'].includes(step.external_api_call_config?.method || 'GET') && (
                    <div className="mt-2">
                        <Label htmlFor={`extapi-body-${step.name}`} className="text-xs font-medium">Body Template (JSON or Text)</Label>
                        <Textarea id={`extapi-body-${step.name}`}
                                  value={typeof step.external_api_call_config?.body_template === 'string' ? step.external_api_call_config.body_template : JSON.stringify(step.external_api_call_config?.body_template || {}, null, 2)}
                                  onChange={(e) => {
                                      let bodyValue: any = e.target.value;
                                      try { bodyValue = JSON.parse(e.target.value); } catch (jsonErr) { /* keep as string if not valid JSON */ }
                                      onStepChange({...step, external_api_call_config: {...step.external_api_call_config, body_template: bodyValue } as ExternalApiCallStepConfigType});
                                  }}
                                  rows={4} className="font-mono text-xs" placeholder={`{ "key": "{{context.value}}" }`} />
                    </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 mt-2">
                    <div>
                        <Label htmlFor={`extapi-timeout-${step.name}`} className="text-xs">Timeout (seconds)</Label>
                        <Input type="number" id={`extapi-timeout-${step.name}`} min="1"
                               value={step.external_api_call_config?.timeout_seconds || 30}
                               onChange={(e) => onStepChange({...step, external_api_call_config: {...step.external_api_call_config, timeout_seconds: parseInt(e.target.value) || 30} as ExternalApiCallStepConfigType})}
                               className="h-8 text-xs"/>
                    </div>
                    <div>
                        <Label htmlFor={`extapi-successcodes-${step.name}`} className="text-xs">Success Status Codes (CSV)</Label>
                        <Input type="text" id={`extapi-successcodes-${step.name}`}
                               value={step.external_api_call_config?.success_criteria?.status_codes?.join(',') || '200,201,202,204'}
                               onChange={(e) => {
                                   const codes = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                   onStepChange({...step, external_api_call_config: {...step.external_api_call_config, success_criteria: { status_codes: codes }} as ExternalApiCallStepConfigType});
                               }}
                               placeholder="e.g., 200,201"
                               className="h-8 text-xs"/>
                    </div>
                </div>
                 <p className="text-xs text-gray-500 mt-1">Define HTTP status codes that indicate a successful call.</p>
            </div>
        )}

        {/* Human Task Specific Config */}
        {(step.type === 'human_review' || step.type === 'data_input' || step.type === 'decision') && (
          <div className="p-3 border rounded-md bg-gray-50 space-y-3 mt-2">
            <h5 className="text-sm font-medium text-gray-700">Human Task Configuration</h5>
            <div>
                <Label htmlFor={`step-assigned_role-${step.name}`} className="text-xs">Assigned Role</Label>
                <Input id={`step-assigned_role-${step.name}`} value={step.assigned_role || ''} onChange={(e) => handleChange('assigned_role', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
                <Label htmlFor={`step-deadline_minutes-${step.name}`} className="text-xs">Deadline (minutes from creation)</Label>
                <Input type="number" id={`step-deadline_minutes-${step.name}`} value={step.deadline_minutes || ''}
                       onChange={(e) => handleChange('deadline_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
                       className="h-8 text-xs" placeholder="Optional"/>
            </div>
            <div>
                <Label className="text-xs">Form Schema (JSON)</Label>
                <Textarea
                    value={typeof step.form_schema === 'string' ? step.form_schema : JSON.stringify(step.form_schema || {}, null, 2)}
                    onChange={(e) => {
                        let newSchema = {};
                        try { newSchema = JSON.parse(e.target.value); } catch { /* keep empty or old if invalid */ }
                        handleChange('form_schema', newSchema);
                    }}
                    rows={4}
                    className="font-mono text-xs mt-1"
                    placeholder={'{\n  "type": "object",\n  "properties": { ... }\n}'}
                />
            </div>
            <div>
                <Label className="text-xs font-medium mt-2 block">Escalation Policy</Label>
                <EscalationPolicyEditor
                    policy={step.escalation_policy}
                    onPolicyChange={(updatedPolicy) => handleChange('escalation_policy', updatedPolicy)}
                />
            </div>
          </div>
        )}


        {step.type === 'end' && (
          <div>
            <Label htmlFor={`step-final_status-${step.name}`}>Final Status</Label>
            <Select
              value={step.final_status || 'completed'}
              onValueChange={(value) => handleChange('final_status', value as BaseWorkflowStepDefinition['final_status'])}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Select final status" />
              </SelectTrigger>
              <SelectContent>
                {finalStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status.replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Placeholder for Transitions Editor */}
        {/* Transitions Editor */}
        <div className="pt-4 border-t mt-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">Transitions</h4>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        const newTransition = {
                            to: allStepNames.length > 0 ? allStepNames[0] : "", // Default to first available step or empty
                            condition_type: 'always' as const
                        };
                        onStepChange({ ...step, transitions: [...(step.transitions || []), newTransition] });
                    }}
                >
                    Add Transition
                </Button>
            </div>
            {(step.transitions || []).length === 0 && <p className="text-xs text-gray-500">No transitions defined. Last step in a path or needs an "End" step.</p>}
            {(step.transitions || []).map((transition, index) => (
                <Card key={index} className="p-3 mt-2 space-y-2 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <Label>To Step: <span className="font-semibold">{transition.to || 'Not set'}</span> (Condition: {transition.condition_type})</Label>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                                const newTransitions = (step.transitions || []).filter((_, i) => i !== index);
                                onStepChange({ ...step, transitions: newTransitions });
                            }}
                        >
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                    </div>
                    <p className="text-xs text-gray-600">{transition.description || "No description."}</p>
                    {/* TODO: UI for editing transition details (to, description, condition_type, condition_group) */}
                     {transition.condition_type === 'conditional' && (
import ConditionGroupEditor from './ConditionGroupEditor'; // Import the new component
import { Trash2 } from 'lucide-react'; // Ensure Trash2 is imported if not already

// ... (rest of the imports and component code) ...

            {(step.transitions || []).map((transition, index) => (
                <Card key={index} className="p-3 mt-2 space-y-2 bg-slate-50 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div className="flex-grow">
                            <Label htmlFor={`transition-to-${index}`} className="text-sm">To Step</Label>
                            <Select
                                value={transition.to}
                                onValueChange={(newTo) => {
                                    const newTransitions = [...(step.transitions || [])];
                                    newTransitions[index] = { ...newTransitions[index], to: newTo };
                                    onStepChange({ ...step, transitions: newTransitions });
                                }}
                            >
                                <SelectTrigger className="w-full mt-1 h-8 text-xs"> <SelectValue placeholder="Select next step" /> </SelectTrigger>
                                <SelectContent>
                                    {allStepNames.filter(name => name !== step.name).map(name => (
                                        <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                                    ))}
                                    {/* Option for "END_WORKFLOW" or similar could be added if not using 'end' steps */}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-2 text-red-500 hover:text-red-600 h-8 w-8 mt-5" // Adjusted margin for alignment
                            onClick={() => {
                                const newTransitions = (step.transitions || []).filter((_, i) => i !== index);
                                onStepChange({ ...step, transitions: newTransitions });
                            }}
                        >
                            <Trash2 size={16}/>
                        </Button>
                    </div>
                    <div>
                        <Label htmlFor={`transition-desc-${index}`} className="text-sm">Description</Label>
                        <Input
                            id={`transition-desc-${index}`}
                            type="text"
                            value={transition.description || ''}
                            placeholder="Optional transition description"
                            className="mt-1 h-8 text-xs"
                            onChange={(e) => {
                                const newTransitions = [...(step.transitions || [])];
                                newTransitions[index] = { ...newTransitions[index], description: e.target.value };
                                onStepChange({ ...step, transitions: newTransitions });
                            }}
                        />
                    </div>
                     <div>
                        <Label htmlFor={`transition-type-${index}`} className="text-sm">Condition Type</Label>
                        <Select
                            value={transition.condition_type || 'always'}
                            onValueChange={(val) => {
                                const newTransitions = [...(step.transitions || [])];
                                const newCondType = val as ('always' | 'conditional');
                                newTransitions[index] = {
                                    ...newTransitions[index],
                                    condition_type: newCondType,
                                    // If switching to conditional, add a default group if none exists
                                    condition_group: newCondType === 'conditional'
                                        ? (newTransitions[index].condition_group || { logical_operator: 'AND', conditions: [] })
                                        : undefined
                                };
                                onStepChange({ ...step, transitions: newTransitions });
                            }}
                        >
                            <SelectTrigger className="w-full mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="always" className="text-xs">Always</SelectItem>
                                <SelectItem value="conditional" className="text-xs">Conditional</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {transition.condition_type === 'conditional' && transition.condition_group && (
                        <div className="pt-2">
                           <Label className="text-sm font-medium">Condition Group:</Label>
                           <ConditionGroupEditor
                                group={transition.condition_group}
                                onGroupChange={(updatedGroup) => {
                                    const newTransitions = [...(step.transitions || [])];
                                    newTransitions[index] = { ...newTransitions[index], condition_group: updatedGroup };
                                    onStepChange({ ...step, transitions: newTransitions });
                                }}
                           />
                        </div>
                    )}
                     {transition.condition_type === 'conditional' && !transition.condition_group && (
                         <p className="text-xs text-red-500 italic mt-1">Conditional type selected, but no condition group defined. Please add conditions.</p>
                     )}
                </Card>
            ))}
        </div>

         {/* Placeholder for Error Handling Editor */}
        <div className="pt-4 border-t mt-4">
            <h4 className="font-medium mb-2">Error Handling</h4>
            <div className="p-3 border rounded-md bg-slate-50 space-y-3 shadow-sm">
                {/* Retry Policy */}
                <Label className="text-sm font-semibold block mb-1">Retry Policy (Optional)</Label>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                        <Label htmlFor={`retry-max_attempts-${step.name}`}>Max Attempts</Label>
                        <Input type="number" id={`retry-max_attempts-${step.name}`} min="1"
                            value={step.error_handling?.retry_policy?.max_attempts || 1}
                            onChange={(e) => onStepChange({ ...step, error_handling: { ...step.error_handling, retry_policy: { ...step.error_handling?.retry_policy, max_attempts: parseInt(e.target.value) || 1 } } })}
                            className="h-8 text-xs" />
                    </div>
                    <div>
                        <Label htmlFor={`retry-delay-${step.name}`}>Initial Delay (sec)</Label>
                        <Input type="number" id={`retry-delay-${step.name}`} min="0"
                            value={step.error_handling?.retry_policy?.delay_seconds || ''}
                            onChange={(e) => onStepChange({ ...step, error_handling: { ...step.error_handling, retry_policy: { ...step.error_handling?.retry_policy, delay_seconds: e.target.value ? parseInt(e.target.value) : undefined } } })}
                            className="h-8 text-xs" placeholder="e.g., 5" />
                    </div>
                    <div>
                        <Label htmlFor={`retry-backoff-${step.name}`}>Backoff Strategy</Label>
                        <Select
                            value={step.error_handling?.retry_policy?.backoff_strategy || 'fixed'}
                            onValueChange={(val) => onStepChange({ ...step, error_handling: { ...step.error_handling, retry_policy: { ...step.error_handling?.retry_policy, backoff_strategy: val as 'fixed' | 'exponential' } } })}
                        >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fixed" className="text-xs">Fixed</SelectItem>
                                <SelectItem value="exponential" className="text-xs">Exponential</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-5">
                        <Checkbox id={`retry-jitter-${step.name}`}
                            checked={step.error_handling?.retry_policy?.jitter || false}
                            onCheckedChange={(checked) => onStepChange({ ...step, error_handling: { ...step.error_handling, retry_policy: { ...step.error_handling?.retry_policy, jitter: Boolean(checked) } } })}
                        />
                        <Label htmlFor={`retry-jitter-${step.name}`} className="text-xs font-normal">Jitter</Label>
                    </div>
                </div>

                {/* On Failure Action */}
                <Label className="text-sm font-semibold block mb-1 pt-3">On Failure Action</Label>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                        <Label htmlFor={`onfailure-action-${step.name}`}>Action</Label>
                        <Select
                            value={step.error_handling?.on_failure?.action || 'fail_workflow'}
                            onValueChange={(val) => onStepChange({ ...step, error_handling: { ...step.error_handling, on_failure: { ...step.error_handling?.on_failure, action: val as OnFailureActionType['action'] } }})}
                        >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fail_workflow" className="text-xs">Fail Workflow</SelectItem>
                                <SelectItem value="transition_to_step" className="text-xs">Transition to Step</SelectItem>
                                <SelectItem value="continue_with_error" className="text-xs">Continue with Error</SelectItem>
                                <SelectItem value="manual_intervention" className="text-xs">Manual Intervention</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {step.error_handling?.on_failure?.action === 'transition_to_step' && (
                        <div>
                            <Label htmlFor={`onfailure-next_step-${step.name}`}>Fallback Step</Label>
                            <Select
                                value={step.error_handling?.on_failure?.next_step || ""}
                                onValueChange={(val) => onStepChange({ ...step, error_handling: { ...step.error_handling, on_failure: { ...step.error_handling?.on_failure, next_step: val } }})}
                            >
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select fallback step"/></SelectTrigger>
                                <SelectContent>
                                    {allStepNames.filter(name => name !== step.name).map(name => (
                                        <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div>
                        <Label htmlFor={`onfailure-namespace-${step.name}`}>Error Output Namespace (Opt.)</Label>
                        <Input type="text" id={`onfailure-namespace-${step.name}`}
                            value={step.error_handling?.on_failure?.error_output_namespace || ''}
                            onChange={(e) => onStepChange({ ...step, error_handling: { ...step.error_handling, on_failure: { ...step.error_handling?.on_failure, error_output_namespace: e.target.value || undefined }}})}
                            className="h-8 text-xs" placeholder="e.g., stepErrorDetails"/>
                    </div>
                </div>
            </div>
        </div>


      </CardContent>
    </Card>
  );
};

export default StepConfigurator;
