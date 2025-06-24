
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import AgentBuilder from "./pages/AgentBuilder";
import KnowledgeBase from "./pages/KnowledgeBase";
import Monitor from "./pages/Monitor";
import Tasks from "./pages/Tasks";
import AnalyticsPage from "./pages/Analytics";
import Notifications from "./pages/Notifications";
import Workflows from "./pages/Workflows";
import Security from "./pages/Security";
import Integrations from "./pages/Integrations";
import CustomerManagementPage from "./pages/CustomerManagement";
import LoanManagementPage from "./pages/LoanManagement";
import TransactionManagementPage from "./pages/TransactionManagement";
import AIAgentTemplatesPage from "./pages/AIAgentTemplates";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage"; // Added
import RegisterPage from "./pages/RegisterPage"; // Added
import { Navigate } from "react-router-dom"; // Added

const queryClient = new QueryClient();

// Basic check for auth token
const isAuthenticated = () => !!localStorage.getItem('authToken');

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* Protect other routes as needed */}
          <Route path="/builder" element={<ProtectedRoute><AgentBuilder /></ProtectedRoute>} />
          <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/security" element={<Security />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/customers" element={<CustomerManagementPage />} />
          <Route path="/loans" element={<LoanManagementPage />} />
          <Route path="/transactions" element={<TransactionManagementPage />} />
          <Route path="/ai-templates" element={<AIAgentTemplatesPage />} />
          <Route path="/team" element={<Dashboard />} />
          <Route path="/email" element={<Dashboard />} />
          <Route path="/settings" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
