import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Settings, GitMerge } from 'lucide-react'; // Using GitMerge for workflow icon
import { WorkflowDefinition } from '@/types/workflows';

interface WorkflowDefinitionCardProps {
  workflow: WorkflowDefinition;
  onStartInstance: (workflowId: string, workflowName: string, initialSchema?: Record<string, any>) => void;
  // onEdit?: (workflowId: string) => void; // For future admin editing
}

const WorkflowDefinitionCard: React.FC<WorkflowDefinitionCardProps> = ({ workflow, onStartInstance }) => {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-start space-x-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <GitMerge className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <CardTitle className="text-lg">{workflow.name} <span className="text-xs text-gray-500">v{workflow.version}</span></CardTitle>
            <CardDescription className="text-xs text-gray-500">ID: {workflow.workflow_id}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-gray-700 line-clamp-3">
          {workflow.description || 'No description available.'}
        </p>
        <div className="mt-2 text-xs text-gray-500">
            <p>Starts with: {workflow.definition_json?.start_step || 'N/A'}</p>
            <p>Steps: {workflow.definition_json?.steps?.length || 0}</p>
        </div>
      </CardContent>
      <CardFooter className="flex space-x-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => onStartInstance(workflow.workflow_id, workflow.name, workflow.definition_json?.initialContextSchema)}
          className="flex-1 banking-gradient text-white"
        >
          <PlayCircle className="h-4 w-4 mr-2" />
          Start Instance
        </Button>
        {/* <Button variant="outline" size="sm" onClick={() => onEdit?.(workflow.workflow_id)} disabled>
            <Settings className="h-4 w-4 mr-1" /> Edit (Admin)
        </Button> */}
      </CardFooter>
    </Card>
  );
};

export default WorkflowDefinitionCard;
