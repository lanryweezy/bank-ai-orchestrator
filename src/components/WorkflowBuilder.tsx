
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Play, 
  Pause, 
  GitBranch, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Settings,
  Zap
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  name: string;
  type: 'trigger' | 'action' | 'condition';
  agent?: string;
  status: 'active' | 'inactive' | 'error';
}

const WorkflowBuilder: React.FC = () => {
  const [workflows] = useState([
    {
      id: '1',
      name: 'Loan Application Processing',
      steps: 5,
      status: 'active' as const,
      triggers: 12,
      success_rate: 94
    },
    {
      id: '2', 
      name: 'Customer Onboarding',
      steps: 8,
      status: 'active' as const,
      triggers: 23,
      success_rate: 98
    }
  ]);

  const [workflowSteps] = useState<WorkflowStep[]>([
    { id: '1', name: 'Email Received', type: 'trigger', status: 'active' },
    { id: '2', name: 'Parse Documents', type: 'action', agent: 'Email Parser', status: 'active' },
    { id: '3', name: 'Credit Check', type: 'condition', agent: 'Credit Analyzer', status: 'active' },
    { id: '4', name: 'Send Approval', type: 'action', agent: 'Chatbot', status: 'active' }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive': return <Pause className="h-4 w-4 text-gray-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Workflow Automation</h2>
        <Button className="banking-gradient text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      <Tabs defaultValue="workflows" className="w-full">
        <TabsList>
          <TabsTrigger value="workflows">Active Workflows</TabsTrigger>
          <TabsTrigger value="builder">Workflow Builder</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{workflow.name}</h3>
                    {getStatusIcon(workflow.status)}
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Steps:</span>
                      <span>{workflow.steps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Triggers today:</span>
                      <span>{workflow.triggers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success rate:</span>
                      <span className="text-green-600">{workflow.success_rate}%</span>
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GitBranch className="h-5 w-5 mr-2" />
                Visual Workflow Builder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-blue-600 font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{step.name}</span>
                        <Badge variant="outline">{step.type}</Badge>
                        {step.agent && (
                          <Badge className="bg-blue-100 text-blue-800">
                            {step.agent}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {getStatusIcon(step.status)}
                  </div>
                ))}
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkflowBuilder;
