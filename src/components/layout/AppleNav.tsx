import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
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
  User,
  KeyRound,
  Search,
  Menu,
  X,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import { TrendingUp, Gamepad2, Crosshair } from "lucide-react";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Reuniões', href: '/reunioes', icon: Users },
  { name: 'Processos', href: '/processos', icon: FileText },
  { name: 'Tarefas', href: '/tarefas', icon: ListTodo },
  { name: 'Calendário', href: '/calendario', icon: Calendar },
  { name: 'Metas', href: '/metas', icon: Target },
  { name: 'OKRs', href: '/okrs', icon: Crosshair },
  { name: 'Trade', href: '/trade', icon: ShoppingCart },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Gamificação', href: '/gamificacao', icon: Gamepad2 },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
];

export function AppleNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, role, signOut } = useAuth();
  const { selectedCompanyId, setSelectedCompanyId, companies, setCompanies } = useCompany();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <>
      {/* Main Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <nav className="container-apple">
          <div className="flex h-14 items-center justify-between">
            {/* Logo */}
            <NavLink 
              to="/dashboard" 
              className="flex items-center gap-2 transition-smooth hover:opacity-70"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Target className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg hidden sm:block">GA 360</span>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-1.5 text-sm font-medium rounded-full transition-smooth",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )
                  }
                >
                  {item.name}
                </NavLink>
              ))}
              
              <RoleGuard roles={['ceo', 'super_admin']}>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-1.5 text-sm font-medium rounded-full transition-smooth",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )
                  }
                >
                  Admin
                </NavLink>
              </RoleGuard>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Company Selector - Desktop */}
              <div className="hidden md:block">
                <Select 
                  value={selectedCompanyId || "all"} 
                  onValueChange={(value) => setSelectedCompanyId(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs border-none bg-secondary/50 hover:bg-secondary transition-smooth">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Todas Empresas" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                        {initials}
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{roleDisplay}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="h-4 w-4 mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard/me')}>
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Meu Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/change-password')}>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Alterar Senha
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </nav>

        {/* Search Bar - Expandable */}
        {isSearchOpen && (
          <div className="border-t border-border/50 py-3 animate-fade-in">
            <div className="container-apple">
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar reuniões, tarefas, transcrições..."
                  className="pl-10 h-10 bg-secondary/50 border-none focus-visible:ring-1"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="fixed top-14 left-0 right-0 bottom-0 bg-background animate-slide-up overflow-y-auto">
            <div className="container-apple py-6 space-y-6">
              {/* Company Selector - Mobile */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa</label>
                <Select 
                  value={selectedCompanyId || "all"} 
                  onValueChange={(value) => setSelectedCompanyId(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue placeholder="Todas Empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-smooth",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </NavLink>
                ))}
                
                <RoleGuard roles={['ceo', 'super_admin']}>
                  <div className="border-t border-border my-4" />
                  <NavLink
                    to="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-smooth",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )
                    }
                  >
                    <Settings className="h-5 w-5" />
                    Administração
                  </NavLink>
                </RoleGuard>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
