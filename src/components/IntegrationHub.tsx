
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import IntegrationCard from './IntegrationCard';
import AvailableServiceCard from './AvailableServiceCard';
import IntegrationConfiguration from './IntegrationConfiguration';
import { mockIntegrations, availableServices } from '@/data/mockIntegrations';
import apiClient from '@/services/apiClient';
import AddIntegrationModal from './AddIntegrationModal';

const IntegrationHub: React.FC = () => {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        // const data = await apiClient<any[]>('/integrations');
        // setIntegrations(data);
        setIntegrations(mockIntegrations); // Using mock data for now
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntegrations();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const handleIntegrationAdded = (newIntegration: any) => {
    setIntegrations(prevIntegrations => [newIntegration, ...prevIntegrations]);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Integration Hub</h2>
        <AddIntegrationModal onIntegrationAdded={handleIntegrationAdded} />
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Integrations</TabsTrigger>
          <TabsTrigger value="available">Available Services</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableServices.map((service) => (
              <AvailableServiceCard key={service.id} service={service} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <IntegrationConfiguration />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationHub;
