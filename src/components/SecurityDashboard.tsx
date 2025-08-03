
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockSecurityEvents, mockAuditLogs } from '@/data/mockSecurity';
import apiClient from '@/services/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  Eye, 
  Download,
  FileText,
  Activity,
  Users,
  Key
} from 'lucide-react';

const SecurityDashboard: React.FC = () => {
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        // const events = await apiClient<any[]>('/security/events');
        // const logs = await apiClient<any[]>('/security/audit-logs');
        // setSecurityEvents(events);
        // setAuditLogs(logs);
        setSecurityEvents(mockSecurityEvents); // Using mock data for now
        setAuditLogs(mockAuditLogs); // Using mock data for now
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecurityData();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
        <h2 className="text-2xl font-bold text-gray-900">Security & Audit</h2>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Security Score</p>
                <p className="text-2xl font-bold text-green-600">98%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Events Today</p>
                <p className="text-2xl font-bold">47</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Sessions</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          {securityEvents.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">{event.message}</p>
                      <p className="text-sm text-gray-500">
                        {event.agent && `Agent: ${event.agent}`}
                        {event.user && `User: ${event.user}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getSeverityColor(event.severity)}>
                      {event.severity}
                    </Badge>
                    <span className="text-sm text-gray-500">{event.timestamp}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          {auditLogs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Eye className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{log.action}</p>
                      <p className="text-sm text-gray-500">{log.details}</p>
                      <p className="text-sm text-gray-500">
                        User: {log.user} | Agent: {log.agent}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{log.timestamp}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2" />
                Agent Permissions Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-4 font-medium text-sm border-b pb-2">
                  <span>Agent</span>
                  <span>Read Data</span>
                  <span>Write Data</span>
                  <span>Send Emails</span>
                  <span>API Access</span>
                </div>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <span>Credit Analyzer</span>
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  <Badge className="bg-red-100 text-red-800">✗</Badge>
                </div>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <span>Chatbot</span>
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  <Badge className="bg-red-100 text-red-800">✗</Badge>
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;
