import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import DashboardMe from "./pages/DashboardMe";
import Meetings from "./pages/Meetings";
import Processes from "./pages/Processes";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Trade from "./pages/Trade";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/me" element={<DashboardMe />} />
          <Route path="/reunioes" element={<Meetings />} />
          <Route path="/processos" element={<Processes />} />
          <Route path="/tarefas" element={<Tasks />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
