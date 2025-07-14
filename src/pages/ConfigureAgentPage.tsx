import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { AgentTemplate, ConfiguredAgent } from '@/types/agentTemplates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox'; // For boolean fields
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";


// Helper to render form fields based on JSON schema property

// Forward declaration for recursive calls if needed, or structure differently
let renderObjectProperties: (
    parentKey: string,
    schemaProperties: any,
    objectData: Record<string, any>,
    handleChange: (parentKey: string, fieldKey: string, fieldValue: any, index?: number) => void,
    itemIndex?: number // For items in an array
) => JSX.Element[];

// Define renderObjectProperties
renderObjectProperties = (
    parentKey: string, // The key of the parent object/array in the main configurationData
    schemaProperties: any, // The 'properties' part of the object's schema
    objectData: Record<string, any>, // The current data for this specific object instance
    handleChange: (parentKey: string, fieldKey: string, fieldValue: any, index?: number) => void,
    itemIndex?: number // If this object is an item in an array, its index
) => {
    if (!schemaProperties) return [];
    return Object.entries(schemaProperties).map(([propKey, propValue]) => {
        const fullPropPathForValue = itemIndex !== undefined ? `${parentKey}.${itemIndex}.${propKey}` : `${parentKey}.${propKey}`;
        // Pass parentKey as the actual key of the array/object field in the main configurationData
        // Pass propKey as the key within that object/item
        return renderFormField(
            propKey,
            propValue as any,
            objectData[propKey],
            (fieldKey, fieldValue) => handleChange(parentKey, fieldKey, fieldValue, itemIndex), // handleChange needs to know it's updating a sub-property
            parentKey, // This is the key for the array or object itself
            itemIndex   // This is the index if it's an item within an array of objects
        );
    });
};


const renderFormField = (
  key: string, // The direct key for this field (e.g., 'fieldName', 'operator')
  propSchema: any, // The schema for this specific property
  value: any, // The current value for this property
  handleChange: (fieldKey: string, fieldValue: any, parentKey?: string, itemIndex?: number) => void, // Modified handleChange
  parentKey?: string, // Used if this field is part of a nested object (e.g., an item in an array of objects)
  itemIndex?: number // Used if this field is part of an item in an array of objects
) => {
  // Construct a unique ID for the input field, incorporating parentKey and itemIndex if they exist
  const fieldIdPath = parentKey ? `${parentKey}.${itemIndex !== undefined ? `${itemIndex}.` : ''}${key}` : key;
  const label = propSchema.description || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  const onChange = (val: any) => {
    handleChange(key, val, parentKey, itemIndex);
  };


  if (propSchema.type === 'string') {
    // Could check propSchema.format for 'date-time', 'email', 'uri' etc. for specific input types
    if (propSchema.enum) {
        return (
            <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <select
                    id={fieldIdPath}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="" disabled>{label}</option>
                    {propSchema.enum.map((enumVal: string) => (
                        <option key={enumVal} value={enumVal}>{enumVal}</option>
                    ))}
                </select>
            </div>
        );
    }
    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={fieldIdPath}>{label}</Label>
        <Input
          id={fieldIdPath}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={propSchema.examples ? String(propSchema.examples[0]) : `Enter ${label}`}
        />
      </div>
    );
  } else if (propSchema.type === 'number' || propSchema.type === 'integer') {
    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={fieldIdPath}>{label}</Label>
        <Input
          id={fieldIdPath}
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder={propSchema.examples ? String(propSchema.examples[0]) : `Enter ${label}`}
        />
      </div>
    );
  } else if (propSchema.type === 'boolean') {
    return (
      <div key={key} className="flex items-center space-x-2 pt-2">
        <Checkbox
          id={fieldIdPath}
          checked={!!value}
          onCheckedChange={(checked) => onChange(checked)}
        />
        <Label htmlFor={fieldIdPath} className="cursor-pointer">{label}</Label>
      </div>
    );
  } else if (propSchema.type === 'array' && propSchema.items?.type === 'string') {
    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={fieldIdPath}>{label} (comma-separated)</Label>
        <Textarea
          id={fieldIdPath}
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) => onChange(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
          placeholder={propSchema.examples && Array.isArray(propSchema.examples[0]) ? propSchema.examples[0].join(', ') : `e.g., item1, item2, item3`}
          rows={3}
        />
      </div>
    );
  } else if (propSchema.type === 'array' && propSchema.items?.type === 'object') {
    // This is the section to enhance for array of objects
    const items = Array.isArray(value) ? value : [];
    return (
      <div key={parentKey || key} className="space-y-4 p-4 border rounded-md">
        <Label className="text-lg font-semibold">{label}</Label>
        {items.map((item: any, index: number) => (
          <div key={index} className="p-3 border rounded-md space-y-3 relative">
            <h4 className="font-medium text-md">Item {index + 1}</h4>
            {renderObjectProperties(parentKey || key, propSchema.items.properties, item, handleChange, index)}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                const newItems = items.filter((_, i) => i !== index);
                handleChange(key, newItems, parentKey); // Update the whole array for the parent
              }}
              className="absolute top-2 right-2"
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            // Add a new item with default values based on item schema
            const newItemDefaults: Record<string, any> = {};
            if (propSchema.items.properties) {
                for(const subKey in propSchema.items.properties) {
                    if (propSchema.items.properties[subKey].default !== undefined) {
                        newItemDefaults[subKey] = propSchema.items.properties[subKey].default;
                    } else if (propSchema.items.properties[subKey].type === 'array') {
                        newItemDefaults[subKey] = [];
                    } else if (propSchema.items.properties[subKey].type === 'object') {
                         newItemDefaults[subKey] = {};
                    }
                }
            }
            const newItems = [...items, newItemDefaults];
            handleChange(key, newItems, parentKey); // Update the whole array for the parent
          }}
        >
          Add {propSchema.items.title || 'Item'}
        </Button>
      </div>
    );
  } else if (propSchema.type === 'object') {
     // Handle non-array objects (structs)
    return (
      <div key={parentKey || key} className="space-y-4 p-4 border rounded-md">
        <Label className="text-lg font-semibold">{label}</Label>
        {renderObjectProperties(parentKey || key, propSchema.properties, value || {}, handleChange)}
      </div>
    );
  }
  // Fallback for unsupported types or more complex structures
  return (
    <div key={key} className="space-y-2">
      <Label htmlFor={key}>{label} (JSON)</Label>
      <Textarea
        id={key}
        value={typeof value === 'string' ? value : (value ? JSON.stringify(value, null, 2) : '{}')}
        onChange={(e) => handleChange(key, e.target.value)} // Store as string, parse on submit
        placeholder={`Enter JSON for ${key}`}
        rows={3}
        className="font-mono text-sm"
       />
        <p className="text-xs text-muted-foreground">Enter valid JSON for this field.</p>
     </div>
   );
};


const AgentBuilder: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateId = searchParams.get('templateId');

  const [template, setTemplate] = useState<AgentTemplate | null>(null);
  const [bankSpecificName, setBankSpecificName] = useState('');
  const [configurationData, setConfigurationData] = useState<Record<string, any>>({});

  const [loadingTemplate, setLoadingTemplate] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (templateId) {
      setLoadingTemplate(true);
      setError(null);
      apiClient<AgentTemplate>(`/agent-templates/${templateId}`)
        .then(data => {
          setTemplate(data);
          // Initialize configurationData with default values from schema if any
          const initialConfig: Record<string, any> = {};
          if (data.configurable_params_json_schema?.properties) {
            for (const key in data.configurable_params_json_schema.properties) {
              if (data.configurable_params_json_schema.properties[key].default !== undefined) {
                initialConfig[key] = data.configurable_params_json_schema.properties[key].default;
              } else if (data.configurable_params_json_schema.properties[key].type === 'array') {
                initialConfig[key] = [];
              } else if (data.configurable_params_json_schema.properties[key].type === 'object') {
                initialConfig[key] = {};
              }
            }
          }
          setConfigurationData(initialConfig);
        })
        .catch(err => {
          setError(err.message || `Failed to fetch agent template with ID ${templateId}.`);
          console.error(err);
        })
        .finally(() => setLoadingTemplate(false));
    } else {
      setError("No agent template ID provided. Please select a template first.");
    }
  }, [templateId]);

  const handleConfigChange = (
    fieldKeyOrParentKey: string, // If it's a direct field, this is its key. If nested, this is the parent (array/object) key.
    fieldValueOrSubKey: any,     // If direct, this is the value. If nested, this is the sub-key.
    subValue?: any,              // If nested, this is the actual value for the sub-key.
    itemIndex?: number           // If nested within an array item, this is the index.
  ) => {
    setConfigurationData(prev => {
      const newState = { ...prev };

      if (subValue !== undefined && itemIndex !== undefined) { // Array of objects item field change
        const parentKey = fieldKeyOrParentKey;
        const subKey = fieldValueOrSubKey as string;
        const actualValue = subValue;

        if (!newState[parentKey] || !Array.isArray(newState[parentKey])) {
          newState[parentKey] = [];
        }
        // Ensure the item exists at the index
        while (newState[parentKey].length <= itemIndex) {
            newState[parentKey].push({});
        }
        newState[parentKey][itemIndex] = {
          ...newState[parentKey][itemIndex],
          [subKey]: actualValue,
        };
      } else if (subValue !== undefined && itemIndex === undefined) { // Direct child of an object (not in array)
        const parentKey = fieldKeyOrParentKey;
        const subKey = fieldValueOrSubKey as string;
        const actualValue = subValue;
        newState[parentKey] = {
            ...(newState[parentKey] || {}),
            [subKey]: actualValue,
        };
      } else { // Top-level field change (or array of strings / direct array update)
        const key = fieldKeyOrParentKey;
        const value = fieldValueOrSubKey;
        newState[key] = value;
      }
      return newState;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const parsedConfiguration: Record<string, any> = {};
    let parseError = false;

    // Parse JSON string fields
    if (template.configurable_params_json_schema?.properties) {
        for (const key in template.configurable_params_json_schema.properties) {
            const propSchema = template.configurable_params_json_schema.properties[key];
            const value = configurationData[key];
            if ((propSchema.type === 'array' && propSchema.items?.type === 'object') || (propSchema.type === 'object' && !Array.isArray(value))) {
                try {
                    if (typeof value === 'string' && value.trim() !== '') {
                        parsedConfiguration[key] = JSON.parse(value);
                    } else if (typeof value === 'object') { // Already an object (e.g. from Checkbox or initial default)
                        parsedConfiguration[key] = value;
                    } else {
                        // Use default if specified in schema and value is empty/undefined
                        parsedConfiguration[key] = propSchema.default !== undefined ? propSchema.default : (propSchema.type === 'array' ? [] : {});
                    }
                } catch (err) {
                    setSubmitError(`Invalid JSON format for field ${key}. Please correct it.`);
                    parseError = true;
                    break;
                }
            } else {
                 parsedConfiguration[key] = value;
            }
        }
    }

    if (parseError) {
        setSubmitLoading(false);
        return;
    }


    const payload = {
      template_id: template.template_id,
      bank_specific_name: bankSpecificName,
      configuration_json: parsedConfiguration,
    };

    try {
      const newConfiguredAgent = await apiClient<ConfiguredAgent>('/configured-agents', {
        method: 'POST',
        data: payload,
      });
      setSubmitSuccess(`Successfully configured agent: ${newConfiguredAgent.bank_specific_name} (ID: ${newConfiguredAgent.agent_id})`);
      // Optionally navigate to a different page or clear form
      // navigate('/my-agents');
    } catch (err: any) {
      setSubmitError(err.data?.message || err.message || 'Failed to configure agent.');
      console.error(err);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!templateId) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              No agent template selected. Please go to the <a href="/ai-templates" className="underline">Agent Templates page</a> and choose a template to configure.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  if (loadingTemplate) {
    return (
      <Layout>
        <div className="p-6">
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-6 w-3/4 mb-8" />
          <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-1/3" />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
       <Layout>
        <div className="p-6 text-center">
           <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error Loading Template</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  if (!template) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p>Agent template not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configure Agent: <span className="text-blue-600">{template.name}</span></h1>
          <p className="text-gray-600 mt-1">{template.description || "Configure the parameters for this agent template."}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration Details</CardTitle>
            <CardDescription>Set a name for your agent instance and provide the necessary configuration based on the template.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="bankSpecificName">Agent Instance Name</Label>
                <Input
                  id="bankSpecificName"
                  value={bankSpecificName}
                  onChange={(e) => setBankSpecificName(e.target.value)}
                  placeholder="e.g., My Loan Document Checker"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">A unique name for this specific configuration of the template.</p>
              </div>

              {template.configurable_params_json_schema?.properties && Object.keys(template.configurable_params_json_schema.properties).length > 0 ? (
                Object.entries(template.configurable_params_json_schema.properties).map(([key, propSchema]) => {
                  // For top-level properties, parentKey is effectively the key itself for context, or null/undefined
                  // and itemIndex is not applicable.
                  return renderFormField(key, propSchema, configurationData[key],
                    (fieldKey, fieldValue, parentKeyActual, itemIdx) => {
                        if (parentKeyActual && itemIdx !== undefined) { // Change within an item of an array of objects
                            handleConfigChange(parentKeyActual, fieldKey, fieldValue, itemIdx);
                        } else if (parentKeyActual) { // Change within a direct child object
                            handleConfigChange(parentKeyActual, fieldKey, fieldValue);
                        }else { // Direct change to a top-level field
                            handleConfigChange(fieldKey, fieldValue);
                        }
                    },
                    key // Pass the top-level key as its own parent for context if it's an object/array itself
                    // No itemIndex for top-level rendering
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">This agent template has no specific parameters to configure.</p>
              )}

              {submitSuccess && (
                <Alert variant="default" className="bg-green-50 border-green-300 text-green-700">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>{submitSuccess}</AlertDescription>
                </Alert>
              )}
              {submitError && (
                 <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Configuration Error</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full md:w-auto banking-gradient text-white"
                disabled={submitLoading || !bankSpecificName}
              >
                {submitLoading ? 'Configuring Agent...' : 'Create Configured Agent'}
              </Button>
            </form>
          </CardContent>
        </Card>
         <Button variant="link" onClick={() => navigate('/ai-templates')} className="mt-4">
            &larr; Back to Templates
        </Button>
      </div>
    </Layout>
  );
};

export default AgentBuilder;
