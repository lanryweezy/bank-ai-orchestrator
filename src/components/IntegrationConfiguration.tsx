import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const IntegrationConfiguration: React.FC = () => {
  return (
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
  );
};

export default IntegrationConfiguration;