import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowDefinition } from '@/types/workflows';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Edit, Trash2, ShieldAlert, CheckCircle, XCircle, GitCommit } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const WorkflowVersionsListPage: React.FC = () => {
  const { workflowName } = useParams<{ workflowName: string }>();
  const navigate = useNavigate();

  const [versions, setVersions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);


  const fetchVersions = useCallback(async () => {
    if (!workflowName) {
      setError("Workflow name not provided.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      const data = await apiClient<WorkflowDefinition[]>(`/admin/workflows/name/${workflowName}/versions`);
      setVersions(data.sort((a, b) => b.version - a.version)); // Ensure sorted, though backend should do it
    } catch (err: any) {
      console.error(`Failed to fetch versions for ${workflowName}:`, err);
      setError(err.data?.message || err.message || `Failed to fetch versions for workflow "${workflowName}".`);
    } finally {
      setLoading(false);
    }
  }, [workflowName]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleDeleteVersion = async (definitionId: string, version: number) => {
    if (window.confirm(`Are you sure you want to delete version ${version} of workflow "${workflowName}" (ID: ${definitionId})? This is a DANGEROUS operation.`)) {
      setActionError(null);
      setActionSuccess(null);
      try {
        await apiClient(`/admin/workflows/${definitionId}`, { method: 'DELETE' });
        setActionSuccess(`Version ${version} deleted successfully.`);
        fetchVersions(); // Refresh the list
      } catch (err: any) {
        console.error('Failed to delete workflow definition version:', err);
        setActionError(err.data?.message || err.message || 'Failed to delete workflow version.');
      }
    }
  };

  const handleActivateVersion = async (definitionId: string, version: number) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiClient(`/admin/workflows/${definitionId}/activate`, { method: 'PUT' });
      setActionSuccess(`Version ${version} is now active.`);
      fetchVersions(); // Refresh to show updated active status
    } catch (err: any) {
      console.error('Failed to activate workflow version:', err);
      setActionError(err.data?.message || err.message || 'Failed to activate workflow version.');
    }
  };


  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-6 w-3/4 mb-6" />
          <Skeleton className="h-72 w-full" />
        </div>
      </Layout>
    );
  }

  if (error && (error.includes('Forbidden') || error.includes('Unauthorized'))) {
     return (
      <Layout>
        <div className="p-6 flex flex-col items-center justify-center text-center" style={{minHeight: 'calc(100vh - 200px)'}}>
          <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
          <Alert variant="destructive" className="max-w-md"><AlertTitle>Access Denied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
          <Button variant="outline" onClick={() => navigate('/admin/workflow-definitions')} className="mt-6">Back to Definitions List</Button>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/workflow-definitions')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to All Workflows
        </Button>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
                <CardTitle className="text-2xl">Versions for: {workflowName}</CardTitle>
                <CardDescription>Manage all versions of the workflow "{workflowName}".</CardDescription>
            </div>
            <Button onClick={() => navigate(`/admin/workflow-definitions/new-version/${workflowName}`)} className="bg-sky-500 hover:bg-sky-600 text-white">
                <GitCommit className="h-4 w-4 mr-2" /> Create New Version
            </Button>
          </CardHeader>
          <CardContent>
            {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error Loading Versions</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {actionError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Action Error</AlertTitle>
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            )}
            {actionSuccess && (
                <Alert variant="default" className="mb-4 bg-green-50 border-green-400 text-green-700">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{actionSuccess}</AlertDescription>
                </Alert>
            )}

            {versions.length === 0 && !loading && !error && (
              <div className="text-center py-10">
                <p className="text-gray-500">No versions found for this workflow definition name.</p>
                <p className="text-xs text-gray-400 mt-1">This might occur if the workflow name itself was deleted or never existed.</p>
              </div>
            )}

            {versions.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10%] text-center">Version</TableHead>
                    <TableHead className="w-[35%]">Description</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((def) => (
                    <TableRow key={def.workflow_id} className={def.is_active ? 'bg-green-50' : ''}>
                      <TableCell className="font-medium text-center">{def.version}</TableCell>
                      <TableCell className="text-sm text-gray-600 line-clamp-2" title={def.description}>
                        {def.description || <span className="text-gray-400 italic">No description</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={def.is_active ? 'default' : 'outline'} className={def.is_active ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}>
                          {def.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(def.updated_at), 'PPpp')}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {!def.is_active && (
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleActivateVersion(def.workflow_id, def.version)}
                                className="hover:bg-green-100 hover:text-green-700"
                                title="Activate this version"
                            >
                                <CheckCircle className="h-4 w-4 mr-1"/> Activate
                            </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="hover:text-blue-600"
                          title="Edit this version's details"
                        >
                          <Link to={`/admin/workflow-definitions/edit/${def.workflow_id}`}>
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteVersion(def.workflow_id, def.version)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete this version"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
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

export default WorkflowVersionsListPage;
