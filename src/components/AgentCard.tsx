
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Activity, Mail, Settings, Play, Pause } from 'lucide-react';

interface AgentCardProps {
  name: string;
  department: string;
  status: 'active' | 'inactive' | 'learning';
  tasksCompleted: number;
  accuracy: number;
  type: string;
  onConfigure: () => void;
  onToggle: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
  name,
  department,
  status,
  tasksCompleted,
  accuracy,
  type,
  onConfigure,
  onToggle
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'active': return 'bg-futuristic-accent';
      case 'inactive': return 'bg-gray-500';
      case 'learning': return 'bg-futuristic-secondary';
      default: return 'bg-gray-500';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'chatbot': return <BrainCircuit className="h-6 w-6 text-futuristic-primary" />;
      case 'email': return <Mail className="h-6 w-6 text-futuristic-primary" />;
      default: return <Activity className="h-6 w-6 text-futuristic-primary" />;
    }
  };

  return (
    <Card className="bg-sidebar border-sidebar-border hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sidebar-primary rounded-lg">
              {getIcon()}
            </div>
            <div>
              <CardTitle className="text-lg text-futuristic-foreground">{name}</CardTitle>
              <p className="text-sm text-sidebar-foreground">{department}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            <Badge variant="secondary" className="bg-sidebar-primary text-sidebar-foreground">{status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-sidebar-foreground">Tasks Completed</p>
            <p className="font-semibold text-lg text-futuristic-foreground">{tasksCompleted}</p>
          </div>
          <div>
            <p className="text-sidebar-foreground">Accuracy</p>
            <p className="font-semibold text-lg text-futuristic-foreground">{accuracy}%</p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            className="flex-1 border-sidebar-border text-sidebar-foreground"
          >
            {status === 'active' ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Start
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onConfigure}
            className="border-sidebar-border text-sidebar-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentCard;
