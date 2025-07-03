
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ConfigureAgentPage from "./pages/ConfigureAgentPage"; // Renamed
import MyConfiguredAgentsPage from "./pages/MyConfiguredAgentsPage"; // Added
import WorkflowRunsPage from "./pages/WorkflowRunsPage"; // Added
import WorkflowRunDetailsPage from "./pages/WorkflowRunDetailsPage"; // Added
import KnowledgeBase from "./pages/KnowledgeBase";
import Monitor from "./pages/Monitor";
import Tasks from "./pages/Tasks";
import AnalyticsPage from "./pages/Analytics";
import Notifications from "./pages/Notifications";
import WorkflowsPage from "./pages/Workflows";
import Security from "./pages/Security";
import Integrations from "./pages/Integrations";
import CustomerManagementPage from "./pages/CustomerManagement";
import LoanManagementPage from "./pages/LoanManagement";
import TransactionManagementPage from "./pages/TransactionManagement";
import AIAgentTemplatesPage from "./pages/AIAgentTemplates";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage"; // Added
import RegisterPage from "./pages/RegisterPage";
import { Navigate } from "react-router-dom";

// Admin Pages
import AgentTemplatesListPageAdmin from "./pages/Admin/AgentTemplatesListPage";
import AgentTemplateEditPage from "./pages/Admin/AgentTemplateEditPage";
import WorkflowDefinitionsListPageAdmin from "./pages/Admin/WorkflowDefinitionsListPage";
import WorkflowDefinitionEditPage from "./pages/Admin/WorkflowDefinitionEditPage";
import TriggersListPageAdmin from "./pages/Admin/TriggersListPage"; // Import Triggers List Page
import TriggerEditPage from "./pages/Admin/TriggerEditPage"; // Import Trigger Edit Page


const queryClient = new QueryClient();

// Basic check for auth token
const isAuthenticated = () => !!localStorage.getItem('authToken');
// Basic check for user role (assuming role is stored in localStorage after login)
const getUserRole = () => localStorage.getItem('userRole');


const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles?: string[] }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = getUserRole();
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />; // Or a dedicated "Unauthorized" page
    }
  }
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Default Route */}
          <Route
            path="/"
            element={
              isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
            }
          />

          {/* User Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/ai-templates" element={<ProtectedRoute><AIAgentTemplatesPage /></ProtectedRoute>} />
          <Route path="/configure-agent" element={<ProtectedRoute><ConfigureAgentPage /></ProtectedRoute>} />
          <Route path="/my-agents" element={<ProtectedRoute><MyConfiguredAgentsPage /></ProtectedRoute>} />

          <Route path="/workflows" element={<ProtectedRoute><WorkflowsPage /></ProtectedRoute>} />
          <Route path="/workflow-runs" element={<ProtectedRoute><WorkflowRunsPage /></ProtectedRoute>} />
          <Route path="/workflow-runs/:runId" element={<ProtectedRoute><WorkflowRunDetailsPage /></ProtectedRoute>} />

          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />

          {/* Placeholder/Other User Routes (ensure protection as needed) */}
          <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
          <Route path="/monitor" element={<ProtectedRoute><Monitor /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
          <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><CustomerManagementPage /></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute><LoanManagementPage /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><TransactionManagementPage /></ProtectedRoute>} />

          {/* Admin Routes - Protected by role */}
          <Route
            path="/admin/agent-templates"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <AgentTemplatesListPageAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/agent-templates/new"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <AgentTemplateEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/agent-templates/edit/:templateId"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <AgentTemplateEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/workflow-definitions"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <WorkflowDefinitionsListPageAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/workflow-definitions/new"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <WorkflowDefinitionEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/workflow-definitions/edit/:workflowId"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <WorkflowDefinitionEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/workflow-definitions/new-version/:workflowName"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <WorkflowDefinitionEditPage /> {/* Re-use edit page, it will need to handle this mode */}
              </ProtectedRoute>
            }
          />
           <Route
            path="/admin/workflow-definitions/new-version/:baseWorkflowName"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <WorkflowDefinitionEditPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Triggers Routes */}
          <Route
            path="/admin/triggers"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <TriggersListPageAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/triggers/new"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <TriggerEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/triggers/edit/:triggerId"
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <TriggerEditPage />
              </ProtectedRoute>
            }
          />

          {/* Legacy/Example Routes (Review and protect as needed) */}
          <Route path="/team" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/email" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Not Found Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
