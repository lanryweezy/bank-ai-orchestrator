
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  Brain, 
  Shield, 
  CreditCard, 
  Users, 
  Calculator,
  MessageSquare,
  Eye,
  FileText,
  TrendingUp,
  Plus,
  Play
} from 'lucide-react';

interface AIAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  inputs: string[];
  tools: string[];
  status: 'active' | 'inactive' | 'training';
  icon: React.ElementType;
  category: string;
}

const AIAgentTemplates: React.FC = () => {
  const [agents] = useState<AIAgent[]>([
    {
      id: '1',
      name: 'Customer Onboarding Agent',
      role: 'KYC & Account Creation Specialist',
      description: 'Manages the entire KYC process from registration to verification and account creation',
      inputs: ['Name', 'BVN', 'ID Card', 'Utility Bill', 'Selfie'],
      tools: ['OCR API', 'Face Match API', 'BVN/NIN Verification', 'Core Banking API'],
      status: 'active',
      icon: Users,
      category: 'onboarding'
    },
    {
      id: '2',
      name: 'Credit Analyst Agent',
      role: 'Loan Assessment & Risk Analysis',
      description: 'Assesses loan applications and provides approval/rejection recommendations',
      inputs: ['Loan Application', 'Income Proof', 'Transaction History', 'Credit Bureau Data'],
      tools: ['Document Analysis', 'Credit Scoring Model', 'Risk Rules Engine', 'ML Classifier'],
      status: 'active',
      icon: Calculator,
      category: 'lending'
    },
    {
      id: '3',
      name: 'Fraud Detection Agent',
      role: 'Real-time Transaction Monitoring',
      description: 'Monitors transactions for suspicious activity and fraud patterns',
      inputs: ['Transaction Logs', 'User Behavior Data', 'Device Information'],
      tools: ['Pattern Matching', 'Anomaly Detection', 'ML Models', 'Rules Engine'],
      status: 'active',
      icon: Shield,
      category: 'security'
    },
    {
      id: '4',
      name: 'Customer Support Agent',
      role: 'Intelligent Customer Service',
      description: 'Resolves customer queries and provides 24/7 support via multiple channels',
      inputs: ['Customer Query', 'Account Information', 'Transaction History'],
      tools: ['NLP Processing', 'Knowledge Base', 'CRM Integration', 'Ticket System'],
      status: 'training',
      icon: MessageSquare,
      category: 'support'
    },
    {
      id: '5',
      name: 'Compliance Agent',
      role: 'AML/CFT Monitoring',
      description: 'Enforces regulatory compliance and monitors for AML/CFT violations',
      inputs: ['Transaction Data', 'Customer Profiles', 'Regulatory Updates'],
      tools: ['Sanctions Screening', 'AML Rules', 'Regulatory Database', 'Report Generator'],
      status: 'active',
      icon: FileText,
      category: 'compliance'
    },
    {
      id: '6',
      name: 'Teller Agent',
      role: 'Digital Transaction Assistant',
      description: 'Handles deposits, withdrawals, transfers, and balance inquiries',
      inputs: ['Transaction Type', 'Amount', 'Account Number', 'Authentication'],
      tools: ['Core Banking API', 'OTP Service', 'Balance Checker', 'Receipt Generator'],
      status: 'active',
      icon: CreditCard,
      category: 'operations'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'training': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryAgents = (category: string) => {
    return agents.filter(agent => agent.category === category);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">AI Agent Templates</h2>
        <Button className="banking-gradient text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create Custom Agent
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Agents</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="lending">Lending</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const IconComponent = agent.icon;
              return (
                <Card key={agent.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <IconComponent className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{agent.name}</h3>
                          <p className="text-sm text-gray-600">{agent.role}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(agent.status)}>
                        {agent.status}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{agent.description}</p>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">KEY INPUTS</p>
                        <div className="flex flex-wrap gap-1">
                          {agent.inputs.slice(0, 3).map((input, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {input}
                            </Badge>
                          ))}
                          {agent.inputs.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{agent.inputs.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">TOOLS & APIS</p>
                        <div className="flex flex-wrap gap-1">
                          {agent.tools.slice(0, 2).map((tool, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                          {agent.tools.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{agent.tools.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Play className="h-4 w-4 mr-1" />
                        Deploy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {['onboarding', 'lending', 'security', 'support', 'compliance'].map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getCategoryAgents(category).map((agent) => {
                const IconComponent = agent.icon;
                return (
                  <Card key={agent.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <IconComponent className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{agent.name}</h3>
                            <p className="text-sm text-gray-600">{agent.role}</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(agent.status)}>
                          {agent.status}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-4">{agent.description}</p>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">WORKFLOW</p>
                          <div className="text-xs text-gray-600">
                            {category === 'onboarding' && '1. Collect docs → 2. Verify identity → 3. Create account → 4. Send welcome'}
                            {category === 'lending' && '1. Parse application → 2. Score risk → 3. Check eligibility → 4. Recommend decision'}
                            {category === 'security' && '1. Monitor transactions → 2. Detect patterns → 3. Flag anomalies → 4. Alert compliance'}
                            {category === 'support' && '1. Understand query → 2. Search knowledge → 3. Provide answer → 4. Log interaction'}
                            {category === 'compliance' && '1. Screen transactions → 2. Check sanctions → 3. Flag suspicious → 4. Generate reports'}
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-2 mt-4 pt-4 border-t">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Play className="h-4 w-4 mr-1" />
                          Deploy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AIAgentTemplates;
