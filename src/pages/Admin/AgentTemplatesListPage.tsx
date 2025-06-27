import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout'; // Assuming a common Layout component
import apiClient from '@/services/apiClient';
import { AgentTemplate } from '@/types/agentTemplates'; // Assuming this type is defined
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const AgentTemplatesListPageAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The admin endpoint for agent templates
      const data = await apiClient<AgentTemplate[]>('/admin/agent-templates');
      setTemplates(data);
    } catch (err: any) {
      console.error('Failed to fetch agent templates:', err);
      setError(err.data?.message || err.message || 'Failed to fetch agent templates. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (templateId: string, templateName: string) => {
    if (window.confirm(`Are you sure you want to delete the agent template "${templateName}" (ID: ${templateId})? This action cannot be undone.`)) {
      try {
        await apiClient(`/admin/agent-templates/${templateId}`, { method: 'DELETE' });
        setTemplates(prevTemplates => prevTemplates.filter(t => t.template_id !== templateId));
        // Could add a success toast/message here
      } catch (err: any) {
        console.error('Failed to delete agent template:', err);
        setError(err.data?.message || err.message || 'Failed to delete agent template.');
        // Consider a toast for error message as well
      }
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-10 w-36" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  // Specific error handling for unauthorized access
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
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Agent Templates</h1>
            <p className="text-sm text-gray-600">Create, view, edit, and delete AI agent templates for the platform.</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => navigate('/admin/agent-templates/new')} className="banking-gradient text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create New Template
            </Button>
          </div>
        </div>

        {error && !error.includes('Forbidden') && !error.includes('Unauthorized') && ( // General error display
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {templates.length === 0 && !loading && !error && (
          <Card className="text-center py-12">
            <CardHeader>
              <CardTitle className="text-xl text-gray-700">No Agent Templates Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 mb-4">Get started by creating the first agent template.</p>
              <Button onClick={() => navigate('/admin/agent-templates/new')}>
                Create New Template
              </Button>
            </CardContent>
          </Card>
        )}

        {templates.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%]">Name</TableHead>
                    <TableHead className="w-[35%]">Description</TableHead>
                    <TableHead>Core Logic ID</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.template_id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-sm text-gray-600 line-clamp-2" title={template.description}>
                        {template.description || <span className="text-gray-400 italic">No description</span>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        <code className="text-xs bg-gray-100 p-1 rounded">{template.core_logic_identifier}</code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/agent-templates/edit/${template.template_id}`)}
                          className="mr-2 hover:text-blue-600"
                          title="Edit Template"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.template_id, template.name)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete Template"
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
        )}
      </div>
    </Layout>
  );
};

export default AgentTemplatesListPageAdmin;
