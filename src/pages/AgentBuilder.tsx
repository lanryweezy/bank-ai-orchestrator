
import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Brain, Code, Mail, FileText, Zap } from 'lucide-react';

const AgentBuilder = () => {
  const [agentName, setAgentName] = useState('');
  const [department, setDepartment] = useState('');
  const [agentType, setAgentType] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [rules, setRules] = useState('');
  const [output, setOutput] = useState('');

  const agentTypes = [
    { value: 'chatbot', label: 'Customer Support Chatbot', icon: Bot },
    { value: 'email_parser', label: 'Email Parser & Analyzer', icon: Mail },
    { value: 'credit_analyzer', label: 'Credit Analyzer', icon: Brain },
    { value: 'document_processor', label: 'Document Processor', icon: FileText },
    { value: 'compliance_checker', label: 'Compliance Checker', icon: Zap },
  ];

  const departments = [
    'Customer Service',
    'Loans & Credit',
    'Compliance',
    'Operations',
    'IT Support',
    'HR',
    'Marketing',
    'Risk Management'
  ];

  const handleGenerate = async () => {
    const payload = {
      agent_name: agentName,
      department,
      agent_type: agentType,
      description,
      prompt,
      rules: rules.split('\n').filter(rule => rule.trim()),
    };

    try {
      const response = await fetch('/api/ai-builder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setOutput(JSON.stringify(data, null, 2));
    } catch (error) {
      setOutput(`Error: ${error}`);
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Agent Builder</h1>
          <p className="text-gray-600 mt-1">Create and configure intelligent banking agents</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bot className="h-5 w-5 mr-2 text-blue-600" />
                Agent Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="behavior">Behavior</TabsTrigger>
                  <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div>
                    <Label htmlFor="agentName">Agent Name</Label>
                    <Input
                      id="agentName"
                      placeholder="e.g., Credit Analyzer Agent"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="agentType">Agent Type</Label>
                    <Select value={agentType} onValueChange={setAgentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent type" />
                      </SelectTrigger>
                      <SelectContent>
                        {agentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center">
                              <type.icon className="h-4 w-4 mr-2" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this agent does..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="behavior" className="space-y-4">
                  <div>
                    <Label htmlFor="prompt">System Prompt</Label>
                    <Textarea
                      id="prompt"
                      placeholder="You are an AI agent that helps with..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={6}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="knowledge" className="space-y-4">
                  <div>
                    <Label htmlFor="rules">Business Rules (one per line)</Label>
                    <Textarea
                      id="rules"
                      placeholder="Reject if BVN is missing&#10;Approve if income > 2x loan amount&#10;Escalate if suspicious activity detected"
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      rows={8}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button 
                onClick={handleGenerate}
                className="w-full banking-gradient text-white"
                disabled={!agentName || !department || !agentType}
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate Agent
              </Button>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Code className="h-5 w-5 mr-2 text-green-600" />
                Agent Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {output ? (
                <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96">
                  {output}
                </pre>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Configure your agent and click "Generate Agent" to see the preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Templates */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Start Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agentTypes.slice(0, 3).map((type) => (
                <Button
                  key={type.value}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => {
                    setAgentType(type.value);
                    setAgentName(type.label);
                  }}
                >
                  <type.icon className="h-6 w-6 mb-2 text-blue-600" />
                  <span className="font-medium">{type.label}</span>
                  <span className="text-xs text-gray-500 mt-1">Click to use template</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AgentBuilder;
