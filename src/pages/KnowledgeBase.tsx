
import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Upload, 
  Save, 
  FileText, 
  Brain, 
  Settings,
  Search,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';

const KnowledgeBase = () => {
  const [selectedAgent, setSelectedAgent] = useState('credit-analyzer');
  const [searchTerm, setSearchTerm] = useState('');
  const [newRule, setNewRule] = useState('');
  const [newTemplate, setNewTemplate] = useState('');

  const agents = [
    { id: 'credit-analyzer', name: 'Credit Analyzer', department: 'Loans' },
    { id: 'chatbot', name: 'Customer Support Bot', department: 'Customer Service' },
    { id: 'email-parser', name: 'Email Parser', department: 'Operations' },
    { id: 'kyc-validator', name: 'KYC Validator', department: 'Compliance' },
  ];

  const knowledgeItems = [
    {
      id: 1,
      type: 'rule',
      title: 'BVN Requirement',
      content: 'All loan applications must include a valid BVN number',
      category: 'Loan Processing',
      lastUpdated: '2024-01-15'
    },
    {
      id: 2,
      type: 'template',
      title: 'Loan Approval Response',
      content: 'Dear {{customer_name}}, your loan application for ₦{{amount}} has been approved...',
      category: 'Communication',
      lastUpdated: '2024-01-10'
    },
    {
      id: 3,
      type: 'rule',
      title: 'Income Verification',
      content: 'Monthly income must be at least 2x the requested loan amount',
      category: 'Loan Processing',
      lastUpdated: '2024-01-12'
    },
  ];

  const handleSaveRule = () => {
    if (newRule.trim()) {
      console.log('Saving rule:', newRule);
      setNewRule('');
    }
  };

  const handleSaveTemplate = () => {
    if (newTemplate.trim()) {
      console.log('Saving template:', newTemplate);
      setNewTemplate('');
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Base Management</h1>
          <p className="text-gray-600 mt-1">Update and manage AI agent knowledge, rules, and templates</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Agent Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Brain className="h-5 w-5 mr-2 text-blue-600" />
                Agents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.map((agent) => (
                <Button
                  key={agent.id}
                  variant={selectedAgent === agent.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <div className="text-left">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.department}</div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Knowledge Management */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-green-600" />
                  Knowledge Base - {agents.find(a => a.id === selectedAgent)?.name}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                    <Input
                      placeholder="Search knowledge..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="rules" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="rules">Rules</TabsTrigger>
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="rules" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Business Rules</h3>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Rule
                    </Button>
                  </div>

                  <Card>
                    <CardContent className="pt-4">
                      <Label htmlFor="newRule">New Business Rule</Label>
                      <Textarea
                        id="newRule"
                        placeholder="Enter a new business rule..."
                        value={newRule}
                        onChange={(e) => setNewRule(e.target.value)}
                        className="mt-2"
                        rows={3}
                      />
                      <Button 
                        onClick={handleSaveRule}
                        className="mt-2"
                        size="sm"
                        disabled={!newRule.trim()}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save Rule
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    {knowledgeItems
                      .filter(item => item.type === 'rule')
                      .map((item) => (
                        <Card key={item.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h4 className="font-medium">{item.title}</h4>
                                  <Badge variant="secondary">{item.category}</Badge>
                                </div>
                                <p className="text-sm text-gray-600">{item.content}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                  Last updated: {item.lastUpdated}
                                </p>
                              </div>
                              <div className="flex space-x-1">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="templates" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Response Templates</h3>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Template
                    </Button>
                  </div>

                  <Card>
                    <CardContent className="pt-4">
                      <Label htmlFor="newTemplate">New Response Template</Label>
                      <Textarea
                        id="newTemplate"
                        placeholder="Enter a new response template with {{variables}}..."
                        value={newTemplate}
                        onChange={(e) => setNewTemplate(e.target.value)}
                        className="mt-2"
                        rows={4}
                      />
                      <Button 
                        onClick={handleSaveTemplate}
                        className="mt-2"
                        size="sm"
                        disabled={!newTemplate.trim()}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save Template
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    {knowledgeItems
                      .filter(item => item.type === 'template')
                      .map((item) => (
                        <Card key={item.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h4 className="font-medium">{item.title}</h4>
                                  <Badge variant="secondary">{item.category}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                                  {item.content}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                  Last updated: {item.lastUpdated}
                                </p>
                              </div>
                              <div className="flex space-x-1">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Document Library</h3>
                    <p className="text-gray-500 mb-4">Upload documents to train your agents</p>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Documents
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Settings className="h-5 w-5 mr-2" />
                        Agent Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Confidence Threshold</Label>
                        <Input type="number" placeholder="0.85" className="mt-1" />
                      </div>
                      <div>
                        <Label>Max Response Length</Label>
                        <Input type="number" placeholder="500" className="mt-1" />
                      </div>
                      <div>
                        <Label>Escalation Trigger</Label>
                        <Input placeholder="human_required" className="mt-1" />
                      </div>
                      <Button>
                        <Save className="h-4 w-4 mr-2" />
                        Save Settings
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default KnowledgeBase;
