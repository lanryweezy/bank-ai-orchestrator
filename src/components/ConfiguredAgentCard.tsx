import React from 'react';
// import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cog, Play, Trash2, Edit3 } from 'lucide-react'; // Example icons
import { ConfiguredAgent } from '@/types/agentTemplates';

interface ConfiguredAgentCardProps {
  agent: ConfiguredAgent;
  onExecute?: (agentId: string) => void;
  onEdit?: (agentId: string) => void;
  onDelete?: (agentId: string) => void;
}

const ConfiguredAgentCard: React.FC<ConfiguredAgentCardProps> = ({ agent, onExecute, onEdit, onDelete }) => {
  // const navigate = useNavigate();

  const getStatusColor = () => {
    switch (agent.status) {
      case 'active': return 'bg-green-500 text-green-50';
      case 'inactive': return 'bg-gray-500 text-gray-50';
      case 'error': return 'bg-red-500 text-red-50';
      default: return 'bg-yellow-500 text-yellow-50'; // For any other status
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-100 rounded-lg">
                    <Cog className="h-6 w-6 text-indigo-600" /> {/* Generic Icon for configured agents */}
                </div>
                <div>
                    <CardTitle className="text-lg">{agent.bank_specific_name}</CardTitle>
                    <CardDescription className="text-xs text-gray-500">Template: {agent.template_name || agent.template_id}</CardDescription>
                </div>
            </div>
            <Badge className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor()}`}>
                {agent.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-gray-600 mb-2">Instance ID: <code className="text-xs bg-gray-100 p-1 rounded">{agent.agent_id}</code></p>
        {agent.configuration_json && Object.keys(agent.configuration_json).length > 0 && (
            <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View Configuration</summary>
                <pre className="mt-1 bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(agent.configuration_json, null, 2)}
                </pre>
            </details>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        {onExecute && (
            <Button variant="outline" size="sm" onClick={() => onExecute(agent.agent_id)} className="flex-1">
                <Play className="h-4 w-4 mr-1" /> Execute (Test)
            </Button>
        )}
        {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(agent.agent_id)} className="flex-1 sm:flex-none">
                <Edit3 className="h-4 w-4 mr-1" /> Edit
            </Button>
        )}
         {onDelete && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(agent.agent_id)} className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ConfiguredAgentCard;
