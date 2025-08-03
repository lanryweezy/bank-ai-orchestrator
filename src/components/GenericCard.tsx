import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GenericCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  status?: string;
  statusColor?: string;
  children: React.ReactNode;
}

const GenericCard: React.FC<GenericCardProps> = ({
  title,
  subtitle,
  icon,
  status,
  statusColor,
  children,
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {icon && <div className="p-2 bg-blue-100 rounded-full">{icon}</div>}
            <div>
              <CardTitle>{title}</CardTitle>
              {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
            </div>
          </div>
          {status && (
            <div className="flex items-center space-x-2">
              {statusColor && <div className={`w-3 h-3 rounded-full ${statusColor}`} />}
              <Badge variant="secondary">{status}</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

export default GenericCard;
