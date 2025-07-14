import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AvailableService } from '@/types/integrations';

interface AvailableServiceCardProps {
  service: AvailableService;
}

const AvailableServiceCard: React.FC<AvailableServiceCardProps> = ({ service }) => {
  const IconComponent = service.icon;

  return (
    <Card className="border-dashed border-2 hover:shadow-md transition-shadow">
      <CardContent className="p-6 text-center">
        <div className="p-3 bg-gray-100 rounded-lg inline-block mb-4">
          <IconComponent className="h-8 w-8 text-gray-600" />
        </div>
        <h3 className="font-semibold mb-2">{service.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{service.description}</p>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Connect
        </Button>
      </CardContent>
    </Card>
  );
};

export default AvailableServiceCard;