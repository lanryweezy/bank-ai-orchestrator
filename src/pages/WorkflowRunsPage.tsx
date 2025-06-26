import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { WorkflowRun, WorkflowDefinition } from '@/types/workflows';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter, ListChecks, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { format } from 'date-fns'; // For formatting dates

const WorkflowRunsPage: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filterWorkflowId, setFilterWorkflowId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const fetchWorkflowDefinitions = useCallback(async () => {
    try {
      const data = await apiClient<WorkflowDefinition[]>('/workflows');
      setWorkflowDefinitions(data);
    } catch (err) {
      console.error("Failed to fetch workflow definitions for filter:", err);
      // Non-critical error, page can still function
    }
  }, []);

  const fetchWorkflowRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterWorkflowId) params.append('workflowId', filterWorkflowId);
      if (filterStatus) params.append('status', filterStatus);

      const data = await apiClient<WorkflowRun[]>(`/workflow-runs?${params.toString()}`);
      setRuns(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch workflow runs.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterWorkflowId, filterStatus]);

  useEffect(() => {
    fetchWorkflowDefinitions();
    fetchWorkflowRuns();
  }, [fetchWorkflowRuns, fetchWorkflowDefinitions]);

  const getStatusBadgeVariant = (status: WorkflowRun['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default'; // Default is often green-ish
      case 'in_progress': return 'secondary'; // Default is often blue-ish
      case 'pending': return 'outline';
      case 'failed': return 'destructive';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Workflow Runs</h1>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={fetchWorkflowRuns} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
             <Button onClick={() => navigate('/workflows')} className="banking-gradient text-white">
              <ListChecks className="h-4 w-4 mr-2" />
              View Workflow Definitions
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="filterWorkflow" className="text-xs">Filter by Workflow</Label>
                    <Select value={filterWorkflowId} onValueChange={setFilterWorkflowId}>
                        <SelectTrigger id="filterWorkflow">
                            <SelectValue placeholder="All Workflows" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All Workflows</SelectItem>
                            {workflowDefinitions.map(def => (
                                <SelectItem key={def.workflow_id} value={def.workflow_id}>
                                    {def.name} (v{def.version})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 min-w-[150px]">
                     <Label htmlFor="filterStatus" className="text-xs">Filter by Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger id="filterStatus">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All Statuses</SelectItem>
                            {['pending', 'in_progress', 'completed', 'failed', 'cancelled'].map(status => (
                                <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="self-end">
                     <Button onClick={fetchWorkflowRuns} disabled={loading} className="w-full md:w-auto">
                        <Filter className="h-4 w-4 mr-2" /> Apply Filters
                    </Button>
                </div>
            </CardContent>
        </Card>


        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error Loading Workflow Runs</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <GitMerge className="h-16 w-16 mx-auto mb-4 text-gray-300" /> {/* Using GitMerge as workflow icon */}
            <p>No workflow runs found matching your criteria.</p>
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div className="space-y-4">
            {runs.map((run) => (
              <Card key={run.run_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                        <div>
                            <CardTitle className="text-md md:text-lg">{run.workflow_name || 'N/A'} <span className="text-xs text-gray-500">v{run.workflow_version}</span></CardTitle>
                            <CardDescription className="text-xs text-gray-500">Run ID: {run.run_id}</CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(run.status)} className="text-xs self-start sm:self-auto">
                            {run.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                    <p><strong>Current Step:</strong> {run.current_step_name || 'N/A'}</p>
                    <p><strong>Started:</strong> {format(new Date(run.start_time), "PPpp")}</p>
                    {run.end_time && <p><strong>Ended:</strong> {format(new Date(run.end_time), "PPpp")}</p>}
                    {run.triggering_user_id && <p className="text-xs text-gray-500">Triggered by user: {run.triggering_user_id.substring(0,8)}...</p>}
                </CardContent>
                <CardFooter>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/workflow-runs/${run.run_id}`)}>
                        <Eye className="h-4 w-4 mr-2" /> View Details
                    </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WorkflowRunsPage;
