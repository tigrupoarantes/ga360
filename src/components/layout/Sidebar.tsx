import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  ListTodo, 
  Calendar, 
  FileText,
  ShoppingCart,
  BarChart3,
  Settings,
  Target,
  LogOut,
  Building2,
  ChevronDown,
  ChevronRight,
  Shield,
  DollarSign,
  Scale,
  FileSearch,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoIcon from "@/assets/logo-crescer-icon.png";

type NavItem = {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
};

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { 
    name: 'Reuniões', 
    icon: Users,
    children: [
      { name: 'Reuniões', href: '/reunioes', icon: Users },
      { name: 'Calendário', href: '/calendario', icon: Calendar },
    ]
  },
  { name: 'Processos', href: '/processos', icon: FileText },
  { name: 'Tarefas', href: '/tarefas', icon: ListTodo },
  { name: 'Portal de Metas', href: '/metas', icon: Target },
  { 
    name: 'Governança EC', 
    icon: Building,
    children: [
      { name: 'Home', href: '/governanca-ec', icon: LayoutDashboard },
      { name: 'Governança', href: '/governanca-ec/governanca', icon: Shield },
      { name: 'Financeiro', href: '/governanca-ec/financeiro', icon: DollarSign },
      { name: 'Pessoas & Cultura', href: '/governanca-ec/pessoas-cultura', icon: Users },
      { name: 'Jurídico', href: '/governanca-ec/juridico', icon: Scale },
      { name: 'Auditoria', href: '/governanca-ec/auditoria', icon: FileSearch },
    ]
  },
  { name: 'Trade Marketing', href: '/trade', icon: ShoppingCart },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
];

const ceoNavigation = [
  { name: 'Administração', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, role, signOut } = useAuth();
  const { selectedCompanyId, setSelectedCompanyId, companies, setCompanies } = useCompany();
  
  // Check if any child route is active
  const isChildActive = (children?: NavItem['children']) => {
    if (!children) return false;
    return children.some(child => location.pathname === child.href);
  };
  
  // Initialize open state based on active routes
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    navigation.forEach(item => {
      if (item.children && isChildActive(item.children)) {
        initialState[item.name] = true;
      }
    });
    return initialState;
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (data) {
        setCompanies(data);
      }
    };
    
    fetchCompanies();
  }, [setCompanies]);

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : 'Usuário';

  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : 'U';

  const roleDisplay = role === 'super_admin' ? 'Super Admin'
    : role === 'ceo' ? 'CEO'
    : role === 'diretor' ? 'Diretor'
    : role === 'gerente' ? 'Gerente'
    : 'Colaborador';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border animate-fade-in">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <img 
            src={logoIcon} 
            alt="CRESCER+" 
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">CRESCER+</h1>
            <p className="text-xs text-sidebar-foreground/70">Gestão Estratégica</p>
          </div>
        </div>

        {/* Company Selector */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <Select value={selectedCompanyId || "all"} onValueChange={(value) => setSelectedCompanyId(value === "all" ? null : value)}>
            <SelectTrigger className="w-full bg-sidebar-accent/50">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <SelectValue placeholder="Todas as Empresas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Empresas</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => (
            item.children ? (
              <Collapsible
                key={item.name}
                open={openMenus[item.name] || isChildActive(item.children)}
                onOpenChange={(open) => setOpenMenus(prev => ({ ...prev, [item.name]: open }))}
              >
                <CollapsibleTrigger className="w-full">
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                      isChildActive(item.children)
                        ? "bg-sidebar-accent/50 text-sidebar-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronDown 
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        (openMenus[item.name] || isChildActive(item.children)) && "rotate-180"
                      )} 
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.name}
                      to={child.href}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-smooth",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )
                      }
                    >
                      <child.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{child.name}</span>
                    </NavLink>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <NavLink
                key={item.name}
                to={item.href!}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            )
          ))}

          <RoleGuard roles={['ceo', 'super_admin']}>
            <div className="my-4 border-t border-sidebar-border" />
            {ceoNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </RoleGuard>
        </nav>

        {/* User info */}
        <div className="border-t border-sidebar-border p-4 space-y-2">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-sidebar-foreground/70 truncate">
                {roleDisplay}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
