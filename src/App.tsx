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
import OKRs from "./pages/OKRs";
import Metas from "./pages/Metas";
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
import AdminEmployees from "./pages/AdminEmployees";
import AdminGovernancaEC from "./pages/AdminGovernancaEC";
import AdminDatalake from "./pages/AdminDatalake";
import AdminBugReports from "./pages/AdminBugReports";
import AdminApiKeys from "./pages/AdminApiKeys";
import GovernancaEC from "./pages/GovernancaEC";
import GovernancaECArea from "./pages/GovernancaECArea";
import GovernancaECCardDetail from "./pages/GovernancaECCardDetail";
import StockAuditStart from "./pages/StockAuditStart";
import StockAuditExecution from "./pages/StockAuditExecution";
import QLPPage from "./pages/QLPPage";
import ControlePJ from "./pages/ControlePJ";
import ControlePJDetail from "./pages/ControlePJDetail";
import VerbasPage from "./pages/Verbas";
import NotFound from "./pages/NotFound";
import CockpitHome from "@/pages/cockpit/CockpitHome";
import CockpitMap from "@/pages/cockpit/CockpitMap";
import CockpitCommercial from "@/pages/cockpit/CockpitCommercial";
import CockpitLogistics from "@/pages/cockpit/CockpitLogistics";
import CockpitSettings from "@/pages/cockpit/CockpitSettings";
import CockpitPedidos from "@/pages/cockpit/CockpitPedidos";
import CockpitNaoVendas from "@/pages/cockpit/CockpitNaoVendas";
import AdminCockpitVendas from "./pages/AdminCockpitVendas";

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
                  path="/okrs"
                  element={
                    <ProtectedRoute>
                      <OKRs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/metas"
                  element={
                    <ProtectedRoute requiredPermission={{ module: 'metas', action: 'view' }}>
                      <Metas />
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
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/estrutura"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminOrganization />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/areas"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminAreas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminUsers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/empresas"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminCompanies />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/permissions"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminPermissions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/employees"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminEmployees />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/governanca-ec"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminGovernancaEC />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/datalake"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminDatalake />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/bugs"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                      requiredPermission={{ module: 'admin', action: 'view' }}
                    >
                      <AdminBugReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/api-keys"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "ceo", "diretor"]}
                    >
                      <AdminApiKeys />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec"
                  element={
                    <ProtectedRoute>
                      <GovernancaEC />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/:areaSlug"
                  element={
                    <ProtectedRoute>
                      <GovernancaECArea />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/:areaSlug/:cardId"
                  element={
                    <ProtectedRoute>
                      <GovernancaECCardDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/pessoas-cultura/qlp"
                  element={
                    <ProtectedRoute>
                      <QLPPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/pessoas-cultura/controle-pj"
                  element={
                    <ProtectedRoute>
                      <ControlePJ />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/pessoas-cultura/controle-pj/:contractId"
                  element={
                    <ProtectedRoute>
                      <ControlePJDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/pessoas-cultura/verbas"
                  element={
                    <ProtectedRoute>
                      <VerbasPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/auditoria/estoque"
                  element={
                    <ProtectedRoute>
                      <StockAuditStart />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governanca-ec/auditoria/estoque/:auditId"
                  element={
                    <ProtectedRoute>
                      <StockAuditExecution />
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
                <Route path="/change-password" element={<ChangePassword />} />
                <Route
                  path="/cockpit"
                  element={
                    <ProtectedRoute>
                      <CockpitHome />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cockpit/mapa"
                  element={
                    <ProtectedRoute>
                      <CockpitMap />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cockpit/comercial"
                  element={
                    <ProtectedRoute>
                      <CockpitCommercial />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cockpit/logistica"
                  element={
                    <ProtectedRoute>
                      <CockpitLogistics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cockpit/config"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin", "ceo", "diretor"]}>
                      <CockpitSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cockpit/vendas"
                  element={<Navigate to="/cockpit" replace />}
                />
                <Route
                  path="/cockpit/pedidos"
                  element={
                    <ProtectedRoute>
                      <CockpitPedidos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cockpit/nao-vendas"
                  element={
                    <ProtectedRoute>
                      <CockpitNaoVendas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/cockpit-vendas"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin", "ceo"]}>
                      <AdminCockpitVendas />
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
