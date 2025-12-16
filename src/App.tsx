import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import DashboardMe from "./pages/DashboardMe";
import Meetings from "./pages/Meetings";
import MeetingExecution from "./pages/MeetingExecution";
import Processes from "./pages/Processes";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Trade from "./pages/Trade";
import Goals from "./pages/Goals";
import OKRs from "./pages/OKRs";
import Reports from "./pages/Reports";
import Analytics from "./pages/Analytics";
import Gamification from "./pages/Gamification";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import ConfirmAttendance from "./pages/ConfirmAttendance";
import AdminAreas from "./pages/AdminAreas";
import AdminUsers from "./pages/AdminUsers";
import AdminCompanies from "./pages/AdminCompanies";
import AdminOrganization from "./pages/AdminOrganization";
import AdminPermissions from "./pages/AdminPermissions";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CompanyProvider>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/confirm-attendance" element={<ConfirmAttendance />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/me"
                element={
                  <ProtectedRoute>
                    <DashboardMe />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reunioes"
                element={
                  <ProtectedRoute>
                    <Meetings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reunioes/:id/executar"
                element={
                  <ProtectedRoute>
                    <MeetingExecution />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/processos"
                element={
                  <ProtectedRoute>
                    <Processes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tarefas"
                element={
                  <ProtectedRoute>
                    <Tasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendario"
                element={
                  <ProtectedRoute>
                    <Calendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trade"
                element={
                  <ProtectedRoute>
                    <Trade />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/metas"
                element={
                  <ProtectedRoute>
                    <Goals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/okrs"
                element={
                  <ProtectedRoute>
                    <OKRs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gamificacao"
                element={
                  <ProtectedRoute>
                    <Gamification />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ceo', 'super_admin']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/estrutura"
                element={
                  <ProtectedRoute allowedRoles={['ceo', 'super_admin']}>
                    <AdminOrganization />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/areas"
                element={
                  <ProtectedRoute allowedRoles={['ceo', 'super_admin']}>
                    <AdminAreas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['ceo', 'super_admin']}>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/empresas"
                element={
                  <ProtectedRoute allowedRoles={['ceo', 'super_admin']}>
                    <AdminCompanies />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/permissions"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <AdminPermissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['ceo', 'super_admin']}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePassword />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </CompanyProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
