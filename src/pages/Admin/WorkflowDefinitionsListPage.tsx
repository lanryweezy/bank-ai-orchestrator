import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowDefinition } from '@/types/workflows';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, RefreshCw, ShieldAlert, GitCommit, Eye, History } from 'lucide-react'; // Added GitCommit, History
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const WorkflowDefinitionsListPageAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [groupedDefinitions, setGroupedDefinitions] = useState<Record<string, WorkflowDefinition[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllVersions, setShowAllVersions] = useState<boolean>(false);

  const fetchDefinitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = showAllVersions ? '/admin/workflows' : '/admin/workflows?onlyActive=true';
      const data = await apiClient<WorkflowDefinition[]>(endpoint);

      const grouped: Record<string, WorkflowDefinition[]> = {};
      data.forEach(def => {
        if (!grouped[def.name]) {
          grouped[def.name] = [];
        }
        grouped[def.name].push(def);
      });

      // Sort versions within each group (highest version first)
      for (const name in grouped) {
        grouped[name].sort((a, b) => b.version - a.version);
      }
      setGroupedDefinitions(grouped);

    } catch (err: any) {
      console.error('Failed to fetch workflow definitions:', err);
      setError(err.data?.message || err.message || 'Failed to fetch workflow definitions. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  }, [showAllVersions]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const handleDeleteVersion = async (definitionId: string, name: string, version: number) => {
    if (window.confirm(`Are you sure you want to delete version ${version} of workflow "${name}" (ID: ${definitionId})? This is a DANGEROUS operation.`)) {
      try {
        await apiClient(`/admin/workflows/${definitionId}`, { method: 'DELETE' });
        // Refetch to update the list, as deleting one version might affect display (e.g. if it was the latest active)
        fetchDefinitions();
      } catch (err: any) {
        console.error('Failed to delete workflow definition version:', err);
        setError(err.data?.message || err.message || 'Failed to delete workflow version.');
      }
    }
  };

  const handleToggleShowAllVersions = (checked: boolean) => {
    setShowAllVersions(checked);
  };

  const handleCreateNewVersion = (workflowName: string) => {
    // Navigate to the edit page, passing the workflowName to signify creating a new version
    navigate(`/admin/workflow-definitions/new-version/${workflowName}`);
  };


  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-10 w-48" /> {/* Adjusted width */}
          </div>
          <div className="flex items-center space-x-2 mb-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-40" /> {/* Adjusted width */}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </Layout>
    );
  }

  if (error && (error.includes('Forbidden') || error.includes('Unauthorized') || error.includes('admin privileges'))) {
    // Same access denied display as before
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
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Workflow Definitions</h1>
            <p className="text-sm text-gray-600">Create, view, and manage versions of workflow definitions.</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={fetchDefinitions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => navigate('/admin/workflow-definitions/new')} className="banking-gradient text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create New Workflow
            </Button>
          </div>
        </div>

        {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="showAllVersionsToggle"
            checked={showAllVersions}
            onCheckedChange={handleToggleShowAllVersions}
          />
          <Label htmlFor="showAllVersionsToggle" className="text-sm font-medium text-gray-700 cursor-pointer">
            Show all versions for each workflow
          </Label>
        </div>

        {Object.keys(groupedDefinitions).length === 0 && !loading && !error && (
          <Card className="text-center py-12">
             <CardHeader>
              <CardTitle className="text-xl text-gray-700">No Workflow Definitions Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 mb-4">
                {showAllVersions ? "No workflow definitions created yet." : "No active workflow definitions found."}
              </p>
              <Button onClick={() => navigate('/admin/workflow-definitions/new')}>
                Create New Workflow
              </Button>
            </CardContent>
          </Card>
        )}

        {Object.entries(groupedDefinitions).map(([name, versionsInGroup]) => (
          <Card key={name} className="mb-6">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-xl">{name}</CardTitle>
              <Button variant="default" size="sm" onClick={() => handleCreateNewVersion(name)} className="bg-sky-500 hover:bg-sky-600 text-white">
                <GitCommit className="h-4 w-4 mr-1" /> Create New Version
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10%] text-center">Version</TableHead>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* If showAllVersions is false, we display only the first version (which is the latest active due to backend logic for that endpoint) */}
                  {/* If showAllVersions is true, we display all fetched versions for that name */}
                  {(showAllVersions ? versionsInGroup : versionsInGroup.slice(0,1)).map((def) => (
                    <TableRow key={def.workflow_id}>
                      <TableCell className="font-medium text-center">{def.version}</TableCell>
                      <TableCell className="text-sm text-gray-600 line-clamp-2" title={def.description}>
                        {def.description || <span className="text-gray-400 italic">No description</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={def.is_active ? 'default' : 'outline'} className={def.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                          {def.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(def.updated_at), 'PPp')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/workflow-definitions/edit/${def.workflow_id}`)}
                          className="hover:text-blue-600"
                          title="Edit this version's details"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVersion(def.workflow_id, def.name, def.version)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete this version"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
};

export default WorkflowDefinitionsListPageAdmin;
