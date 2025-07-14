import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { Integration } from '@/types/integrations';

interface IntegrationCardProps {
  integration: Integration;
}

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

const IntegrationCard: React.FC<IntegrationCardProps> = ({ integration }) => {
  const IconComponent = integration.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
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
};

export default IntegrationCard;