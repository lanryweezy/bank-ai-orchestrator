
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/builder" element={<AgentBuilder />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/security" element={<Security />} />
          <Route path="/integrations" element={<Integrations />} />
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
