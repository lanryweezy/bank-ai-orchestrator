
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plug, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Plus,
  Database,
  Mail,
  CreditCard,
  Globe
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  description: string;
  icon: React.ElementType;
}

const IntegrationHub: React.FC = () => {
  const [integrations] = useState<Integration[]>([
    {
      id: '1',
      name: 'BankOne Core Banking',
      type: 'Core Banking',
      status: 'connected',
      description: 'Primary core banking system integration',
      icon: Database
    },
    {
      id: '2',
      name: 'Gmail API',
      type: 'Email Service',
      status: 'connected', 
      description: 'Email processing and automation',
      icon: Mail
    },
    {
      id: '3',
      name: 'Paystack',
      type: 'Payment Gateway',
      status: 'connected',
      description: 'Payment processing and verification',
      icon: CreditCard
    },
    {
      id: '4',
      name: 'CBN BVN Service',
      type: 'Identity Verification',
      status: 'error',
      description: 'BVN lookup and validation',
      icon: Globe
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Integration Hub</h2>
        <Button className="banking-gradient text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Integrations</TabsTrigger>
          <TabsTrigger value="available">Available Services</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => {
              const IconComponent = integration.icon;
              return (
                <Card key={integration.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <IconComponent className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-sm text-gray-600">{integration.type}</p>
                        </div>
                      </div>
                      {getStatusIcon(integration.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{integration.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge className={getStatusColor(integration.status)}>
                        {integration.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-1" />
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-dashed border-2 hover:shadow-md transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="p-3 bg-gray-100 rounded-lg inline-block mb-4">
                  <Database className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="font-semibold mb-2">Finacle Core Banking</h3>
                <p className="text-sm text-gray-600 mb-4">Connect to Finacle core banking system</p>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed border-2 hover:shadow-md transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="p-3 bg-gray-100 rounded-lg inline-block mb-4">
                  <Globe className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="font-semibold mb-2">NIBSS API</h3>
                <p className="text-sm text-gray-600 mb-4">Nigerian Inter-Bank Settlement System</p>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="api-endpoint">Core Banking API Endpoint</Label>
                <Input 
                  id="api-endpoint" 
                  placeholder="https://api.bankone.ng/v1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="api-key">API Key</Label>
                <Input 
                  id="api-key" 
                  type="password"
                  placeholder="••••••••••••••••"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input 
                  id="webhook-url" 
                  placeholder="https://yourdomain.com/webhooks"
                  className="mt-1"
                />
              </div>
              <Button className="w-full banking-gradient text-white">
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationHub;
