import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Brain } from 'lucide-react'; // Example icon
import { AgentTemplate } from '@/types/agentTemplates';

interface AgentTemplateCardProps {
  template: AgentTemplate;
}

const AgentTemplateCard: React.FC<AgentTemplateCardProps> = ({ template }) => {
  const navigate = useNavigate();

  const handleConfigure = () => {
    // Navigate to a configuration page, passing the template ID
    navigate(`/configure-agent?templateId=${template.template_id}`);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-start space-x-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Brain className="h-6 w-6 text-blue-600" /> {/* Generic Icon for templates */}
          </div>
          <div>
            <CardTitle className="text-lg">{template.name}</CardTitle>
            {/* <p className="text-sm text-gray-500">{template.core_logic_identifier}</p> */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <CardDescription className="text-sm text-gray-700 line-clamp-3">
          {template.description || 'No description available.'}
        </CardDescription>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={handleConfigure}
          className="w-full"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure this Template
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AgentTemplateCard;
