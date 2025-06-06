
import React from 'react';
import Layout from '@/components/Layout';
import AgentCard from '@/components/AgentCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Bot, 
  TrendingUp, 
  Mail, 
  Plus,
  Brain,
  Activity,
  Zap
} from 'lucide-react';

const Dashboard = () => {
  const agents = [
    {
      name: 'Credit Analyzer',
      department: 'Loans',
      status: 'active' as const,
      tasksCompleted: 247,
      accuracy: 94,
      type: 'analyzer'
    },
    {
      name: 'Customer Support Bot',
      department: 'Customer Service',
      status: 'active' as const,
      tasksCompleted: 1432,
      accuracy: 89,
      type: 'chatbot'
    },
    {
      name: 'Email Parser',
      department: 'Operations',
      status: 'learning' as const,
      tasksCompleted: 89,
      accuracy: 92,
      type: 'email'
    },
    {
      name: 'KYC Validator',
      department: 'Compliance',
      status: 'active' as const,
      tasksCompleted: 156,
      accuracy: 97,
      type: 'validator'
    }
  ];

  const stats = [
    {
      title: 'Active Agents',
      value: '12',
      change: '+3',
      icon: Bot,
      color: 'text-blue-600'
    },
    {
      title: 'Tasks Automated',
      value: '2,847',
      change: '+14%',
      icon: Zap,
      color: 'text-green-600'
    },
    {
      title: 'Accuracy Rate',
      value: '94.2%',
      change: '+2.1%',
      icon: TrendingUp,
      color: 'text-green-600'
    },
    {
      title: 'Human Staff',
      value: '8',
      change: '-4',
      icon: Users,
      color: 'text-orange-600'
    }
  ];

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Banking AI Platform</h1>
              <p className="text-gray-600 mt-1">Manage your AI agents and automation workflows</p>
            </div>
            <Button className="banking-gradient text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className={`text-xs ${stat.color}`}>{stat.change} from last month</p>
                  </div>
                  <div className={`p-3 bg-gray-50 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Agents */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Active AI Agents</h2>
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {agents.map((agent, index) => (
              <AgentCard
                key={index}
                {...agent}
                onConfigure={() => console.log('Configure', agent.name)}
                onToggle={() => console.log('Toggle', agent.name)}
              />
            ))}
          </div>
        </div>

        {/* Meta Agent Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2 text-purple-600" />
              Meta-Agent Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <h4 className="font-medium text-blue-900">Performance Optimization</h4>
                <p className="text-blue-700 text-sm mt-1">
                  Credit Analyzer accuracy improved by 3% after recent knowledge base update
                </p>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                <h4 className="font-medium text-yellow-900">Training Recommendation</h4>
                <p className="text-yellow-700 text-sm mt-1">
                  Email Parser needs additional training on new loan document formats
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                <h4 className="font-medium text-green-900">System Health</h4>
                <p className="text-green-700 text-sm mt-1">
                  All agents operating within normal parameters. No issues detected.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
