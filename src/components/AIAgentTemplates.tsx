import React, { useState, useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { AgentTemplate } from '@/types/agentTemplates';
import AgentTemplateCard from './AgentTemplateCard'; // New component
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

const AIAgentTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient<AgentTemplate[]>('/agent-templates');
        setTemplates(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch agent templates.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">AI Agent Templates</h2>
        {/* "Create Custom Agent" button can be for platform admins later,
            or link to a different part of the AgentBuilder for template creation.
            For now, it's not functional for creating templates.
        */}
        {/* <Button className="banking-gradient text-white" disabled>
          <Plus className="h-4 w-4 mr-2" />
          Create Template (Admin)
        </Button> */}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="h-[125px] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-red-600 bg-red-100 p-4 rounded-md">
          <p>Error fetching templates: {error}</p>
        </div>
      )}

      {!loading && !error && templates.length === 0 && (
        <p className="text-gray-600">No agent templates available at the moment.</p>
      )}

      {!loading && !error && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <AgentTemplateCard key={template.template_id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AIAgentTemplates;
