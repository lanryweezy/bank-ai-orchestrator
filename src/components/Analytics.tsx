
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  ResponsiveContainer
} from 'recharts';

const Analytics: React.FC = () => {
  const performanceData = [
    { name: 'Credit Analyzer', efficiency: 94, accuracy: 97 },
    { name: 'Email Parser', efficiency: 88, accuracy: 91 },
    { name: 'Chatbot', efficiency: 96, accuracy: 89 },
    { name: 'KYC Validator', efficiency: 91, accuracy: 95 },
    { name: 'HR Assistant', efficiency: 87, accuracy: 93 }
  ];

  const timelineData = [
    { time: '00:00', tasks: 12 },
    { time: '04:00', tasks: 8 },
    { time: '08:00', tasks: 45 },
    { time: '12:00', tasks: 67 },
    { time: '16:00', tasks: 52 },
    { time: '20:00', tasks: 23 }
  ];

  const departmentData = [
    { name: 'Loans', value: 35, color: '#3B82F6' },
    { name: 'Customer Service', value: 28, color: '#10B981' },
    { name: 'Compliance', value: 20, color: '#F59E0B' },
    { name: 'Operations', value: 17, color: '#EF4444' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Analytics & Performance</h2>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Agent Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Distribution by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                    >
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Task Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="tasks" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="efficiency" fill="#3B82F6" name="Efficiency %" />
                  <Bar dataKey="accuracy" fill="#10B981" name="Accuracy %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Tasks Completed</p>
                  <p className="text-3xl font-bold text-green-600">+23%</p>
                  <p className="text-xs text-gray-500">vs last month</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Response Time</p>
                  <p className="text-3xl font-bold text-blue-600">-15%</p>
                  <p className="text-xs text-gray-500">vs last month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Error Rate</p>
                  <p className="text-3xl font-bold text-red-600">-8%</p>
                  <p className="text-xs text-gray-500">vs last month</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
