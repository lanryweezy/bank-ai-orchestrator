
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X,
  Settings,
  Filter
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  agent?: string;
  read: boolean;
}

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'error',
      title: 'Agent Failure',
      message: 'Credit Analyzer failed to process loan application due to missing documents',
      timestamp: '2 minutes ago',
      agent: 'Credit Analyzer',
      read: false
    },
    {
      id: '2',
      type: 'success',
      title: 'Task Completed',
      message: 'Monthly compliance report has been generated successfully',
      timestamp: '15 minutes ago',
      agent: 'Compliance Bot',
      read: false
    },
    {
      id: '3',
      type: 'warning',
      title: 'High Load Alert',
      message: 'Email Parser is experiencing high volume - response time may be affected',
      timestamp: '1 hour ago',
      agent: 'Email Parser',
      read: true
    },
    {
      id: '4',
      type: 'info',
      title: 'Knowledge Base Updated',
      message: 'HR Assistant knowledge base has been updated with new policies',
      timestamp: '2 hours ago',
      agent: 'HR Assistant',
      read: true
    }
  ]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="warnings">Warnings</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`transition-all hover:shadow-md ${
                !notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getIcon(notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold">{notification.title}</h4>
                        <Badge className={getTypeColor(notification.type)}>
                          {notification.type}
                        </Badge>
                        {notification.agent && (
                          <Badge variant="outline">
                            {notification.agent}
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-500">{notification.timestamp}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="unread">
          {notifications.filter(n => !n.read).map((notification) => (
            <Card key={notification.id} className="border-l-4 border-l-blue-500 bg-blue-50/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getIcon(notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold">{notification.title}</h4>
                        <Badge className={getTypeColor(notification.type)}>
                          {notification.type}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-500">{notification.timestamp}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAsRead(notification.id)}
                  >
                    Mark as read
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationCenter;
