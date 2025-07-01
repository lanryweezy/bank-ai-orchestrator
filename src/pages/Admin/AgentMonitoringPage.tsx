import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { AgentMonitoringSummary } from '@/types/agents'; // New types for monitoring data
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Activity, Users, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const AgentMonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AgentMonitoringSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<AgentMonitoringSummary>('/admin/agents/monitoring-summary');
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to fetch agent monitoring data:', err);
      setError(err.data?.message || err.message || 'Failed to fetch monitoring data. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'active': return 'default'; // Usually green
      case 'inactive': return 'outline'; // Gray
      case 'error': return 'destructive'; // Red
      default: return 'secondary';
    }
  };


  // Main loading state for the whole page
  if (loading && !summary) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  // Specific error for access denied
  if (error && (error.includes('Forbidden') || error.includes('Unauthorized') || error.includes('admin privileges'))) {
    return (
      <Layout>
        <div className="p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have the necessary permissions to view this page.
              Please contact your administrator if you believe this is an error.
              <p className="mt-2 text-xs">{error}</p>
            </AlertDescription>
          </Alert>
           <Button variant="outline" onClick={() => navigate('/')} className="mt-6">
            Go to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Agent Monitoring Dashboard</h1>
            <p className="text-sm text-gray-600">Overview of configured agent instances and their activity.</p>
          </div>
           <Button variant="outline" size="sm" onClick={fetchMonitoringData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
        </div>

        {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Status Counts Widget */}
        {summary?.status_counts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.status_counts.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{summary.status_counts.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{summary.status_counts.inactive}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error State</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{summary.status_counts.error}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recently Active Agents Widget */}
            <Card>
            <CardHeader>
                <CardTitle>Recently Active Agents</CardTitle>
                <CardDescription>Agents that have recently processed tasks.</CardDescription>
            </CardHeader>
            <CardContent>
                {summary?.recently_active_agents && summary.recently_active_agents.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Template</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Last Activity</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {summary.recently_active_agents.map(agent => (
                        <TableRow key={agent.agent_id}>
                        <TableCell>
                            <Link to={`/admin/configure-agent?agentId=${agent.agent_id}`} className="font-medium text-blue-600 hover:underline"> {/* TODO: Confirm admin edit route */}
                                {agent.bank_specific_name}
                            </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{agent.template_name}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant={getStatusVariant(agent.status)}>{agent.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{format(new Date(agent.last_task_activity), 'PPpp')}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                ) : (
                <p className="text-sm text-gray-500 italic">No recently active agents found.</p>
                )}
            </CardContent>
            </Card>

            {/* Agents in Error State Widget */}
            <Card>
            <CardHeader>
                <CardTitle className="text-red-600">Agents in Error State</CardTitle>
                <CardDescription>Agents currently marked with an error status.</CardDescription>
            </CardHeader>
            <CardContent>
                {summary?.error_state_agents && summary.error_state_agents.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Template</TableHead>
                        <TableHead className="text-right">Last Config Update</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {summary.error_state_agents.map(agent => (
                        <TableRow key={agent.agent_id}>
                        <TableCell>
                            <Link to={`/admin/configure-agent?agentId=${agent.agent_id}`} className="font-medium text-blue-600 hover:underline"> {/* TODO: Confirm admin edit route */}
                                {agent.bank_specific_name}
                            </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{agent.template_name}</TableCell>
                        <TableCell className="text-right text-xs">{format(new Date(agent.last_config_update), 'PPpp')}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                ) : (
                <p className="text-sm text-gray-500 italic">No agents currently in an error state.</p>
                )}
            </CardContent>
            </Card>
        </div>

      </div>
    </Layout>
  );
};

export default AgentMonitoringPage;
