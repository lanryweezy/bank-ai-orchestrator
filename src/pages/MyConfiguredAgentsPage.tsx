import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import apiClient from '@/services/apiClient';
import { ConfiguredAgent } from '@/types/agentTemplates';
import ConfiguredAgentCard from '@/components/ConfiguredAgentCard';
import { Button } from '@/components/ui/button';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

const MyConfiguredAgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [configuredAgents, setConfiguredAgents] = useState<ConfiguredAgent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);


  const fetchConfiguredAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<ConfiguredAgent[]>('/configured-agents');
      setConfiguredAgents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch configured agents.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfiguredAgents();
  }, [fetchConfiguredAgents]);

  const handleExecuteAgent = async (agentId: string) => {
    setExecuteMessage(null);
    setExecuteError(null);
    try {
        // Simple input for now, could be a modal later
        const inputData = prompt("Enter input data for the agent (JSON format, or leave empty for default):", "{}");
        if (inputData === null) return; // User cancelled

        let parsedInputData = {};
        if (inputData.trim() !== "") {
            parsedInputData = JSON.parse(inputData);
        }

        const result = await apiClient<any>(`/configured-agents/${agentId}/execute`, {
            method: 'POST',
            data: { input_data: parsedInputData }
        });
        setExecuteMessage(`Agent executed. Status: ${result.success}. Message: ${result.message}. Output: ${JSON.stringify(result.output, null, 2)}`);
    } catch (err: any) {
        setExecuteError(err.data?.message || err.message || `Failed to execute agent ${agentId}.`);
        console.error(err);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!window.confirm("Are you sure you want to delete this configured agent?")) {
        return;
    }
    try {
        await apiClient(`/configured-agents/${agentId}`, { method: 'DELETE' });
        setConfiguredAgents(prev => prev.filter(agent => agent.agent_id !== agentId));
        alert("Agent deleted successfully.");
    } catch (err: any) {
        alert(`Failed to delete agent: ${err.data?.message || err.message}`);
        console.error(err);
    }
  };

  const handleEditAgent = (agentId: string) => {
    // Navigate to ConfigureAgentPage with agentId to load it for editing
    // This requires ConfigureAgentPage to also handle loading an existing agent's config.
    // For now, this is a placeholder.
    alert(`Edit functionality for agent ${agentId} is not yet implemented. You would typically navigate to the configuration page with this agent's ID to prefill and update its configuration.`);
    // navigate(`/configure-agent?configuredAgentId=${agentId}`); // Example future navigation
  };


  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Configured Agents</h1>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={fetchConfiguredAgents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => navigate('/ai-templates')} className="banking-gradient text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Configure New Agent
            </Button>
          </div>
        </div>

        {executeMessage && (
            <Alert variant="default" className="mb-4 bg-blue-50 border-blue-300 text-blue-700">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Agent Execution</AlertTitle>
                <AlertDescription><pre className="whitespace-pre-wrap">{executeMessage}</pre></AlertDescription>
            </Alert>
        )}
        {executeError && (
            <Alert variant="destructive" className="mb-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Execution Error</AlertTitle>
                <AlertDescription>{executeError}</AlertDescription>
            </Alert>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-[150px] w-full rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && configuredAgents.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Cog className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="mb-4">You haven't configured any agents yet.</p>
            <Button onClick={() => navigate('/ai-templates')}>Configure Your First Agent</Button>
          </div>
        )}

        {!loading && !error && configuredAgents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configuredAgents.map((agent) => (
              <ConfiguredAgentCard
                key={agent.agent_id}
                agent={agent}
                onExecute={handleExecuteAgent}
                onEdit={handleEditAgent} // Placeholder
                onDelete={handleDeleteAgent}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyConfiguredAgentsPage;
