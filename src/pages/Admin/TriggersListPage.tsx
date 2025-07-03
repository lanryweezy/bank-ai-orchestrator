import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowTrigger } from '@/types/workflows'; // Assuming WorkflowTrigger type is in workflows.ts
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, RefreshCw, ShieldAlert, Power, PowerOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const TriggersListPageAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Assuming an admin endpoint to get all triggers.
      // This might need to be created if not already available from triggerAdminRoutes.ts
      // For now, let's assume GET /api/admin/triggers exists and returns WorkflowTrigger[]
      const data = await apiClient<WorkflowTrigger[]>('/admin/triggers');
      setTriggers(data || []);
    } catch (err: any) {
      console.error('Failed to fetch triggers:', err);
      setError(err.data?.message || err.message || 'Failed to fetch triggers. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  const handleDeleteTrigger = async (triggerId: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete trigger "${name}" (ID: ${triggerId})?`)) {
      try {
        await apiClient(`/admin/triggers/${triggerId}`, { method: 'DELETE' });
        fetchTriggers();
      } catch (err: any) {
        console.error('Failed to delete trigger:', err);
        setError(err.data?.message || err.message || 'Failed to delete trigger.');
      }
    }
  };

  const handleToggleEnableTrigger = async (trigger: WorkflowTrigger) => {
    const action = trigger.is_enabled ? "disable" : "enable";
    if (window.confirm(`Are you sure you want to ${action} trigger "${trigger.name}"?`)) {
      try {
        await apiClient(`/admin/triggers/${trigger.trigger_id}`, {
          method: 'PUT',
          data: { is_enabled: !trigger.is_enabled }
        });
        fetchTriggers();
      } catch (err: any)
      {
        setError(err.data?.message || err.message || `Failed to ${action} trigger.`);
      }
    }
  };


  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6"> <Skeleton className="h-8 w-1/3" /> <Skeleton className="h-10 w-40" /> </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </Layout>
    );
  }

  if (error && (error.includes('Forbidden') || error.includes('Unauthorized') || error.includes('admin privileges'))) {
    return (
      <Layout>
        <div className="p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
          <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
          <Alert variant="destructive" className="max-w-md"> <AlertTitle>Access Denied</AlertTitle> <AlertDescription> You do not have the necessary permissions to view this page. Please contact your administrator if you believe this is an error. <p className="mt-2 text-xs">{error}</p> </AlertDescription> </Alert>
          <Button variant="outline" onClick={() => navigate('/')} className="mt-6"> Go to Dashboard </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Workflow Triggers</h1>
            <p className="text-sm text-gray-600">Configure automated triggers (Scheduled, Webhook) for workflows.</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={fetchTriggers} disabled={loading}> <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> </Button>
            <Button onClick={() => navigate('/admin/triggers/new')} className="banking-gradient text-white"> <PlusCircle className="h-4 w-4 mr-2" /> Create New Trigger </Button>
          </div>
        </div>

        {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && ( <Alert variant="destructive" className="mb-4"> <AlertTitle>Error</AlertTitle> <AlertDescription>{error}</AlertDescription> </Alert> )}

        <Card>
          <CardHeader>
            <CardTitle>All Triggers</CardTitle>
            <CardDescription>List of all configured workflow triggers.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {triggers.length === 0 && !loading ? (
              <div className="text-center p-8 text-gray-500">
                <p className="mb-2">No triggers found.</p>
                <Button onClick={() => navigate('/admin/triggers/new')}>Create Your First Trigger</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Workflow ID</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {triggers.map((trigger) => (
                    <TableRow key={trigger.trigger_id}>
                      <TableCell className="font-medium">{trigger.name}</TableCell>
                      <TableCell><Badge variant="secondary">{trigger.type}</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600" title={trigger.workflow_id}>{trigger.workflow_id.substring(0,8)}...</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={trigger.is_enabled ? 'default' : 'outline'} className={trigger.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                          {trigger.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {trigger.last_triggered_at ? format(new Date(trigger.last_triggered_at), 'PPp') : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleToggleEnableTrigger(trigger)} className={trigger.is_enabled ? "hover:text-orange-600" : "hover:text-green-600"} title={trigger.is_enabled ? "Disable Trigger" : "Enable Trigger"}>
                            {trigger.is_enabled ? <PowerOff className="h-4 w-4"/> : <Power className="h-4 w-4"/>}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/triggers/edit/${trigger.trigger_id}`)} className="hover:text-blue-600" title="Edit Trigger"> <Edit className="h-4 w-4" /> </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTrigger(trigger.trigger_id, trigger.name)} className="text-red-500 hover:text-red-700" title="Delete Trigger"> <Trash2 className="h-4 w-4" /> </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TriggersListPageAdmin;
