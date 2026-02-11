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
  LogOut,
  User,
  KeyRound,
  Search,
  Menu,
  X,
  ChevronDown,
  TrendingUp, 
  Gamepad2, 
  Crosshair,
  Building,
  Bug
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BugReportDialog } from "@/components/feedback/BugReportDialog";


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
  { name: 'OKRs', href: '/okrs', icon: Crosshair },
  { name: 'Governança', href: '/governanca-ec', icon: Building },
  { name: 'Trade', href: '/trade', icon: ShoppingCart },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Gamificação', href: '/gamificacao', icon: Gamepad2 },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
];

export function AppleNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, role, signOut } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBugDialogOpen, setIsBugDialogOpen] = useState(false);
  
  // Check if any child route is active
  const isChildActive = (children?: NavItem['children']) => {
    if (!children) return false;
    return children.some(child => location.pathname === child.href);
  };
  
  // Initialize open state based on active routes
  const [openMobileMenus, setOpenMobileMenus] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    navigation.forEach(item => {
      if (item.children && isChildActive(item.children)) {
        initialState[item.name] = true;
      }
    });
    return initialState;
  });

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

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navigation.map((item) => (
                item.children ? (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-full transition-smooth",
                          isChildActive(item.children)
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        )}
                      >
                        {item.name}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px]">
                      {item.children.map((child) => (
                        <DropdownMenuItem
                          key={child.name}
                          onClick={() => navigate(child.href)}
                          className={cn(
                            "cursor-pointer",
                            location.pathname === child.href && "bg-secondary"
                          )}
                        >
                          <child.icon className="h-4 w-4 mr-2" />
                          {child.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <NavLink
                    key={item.name}
                    to={item.href!}
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
                )
              ))}
              
              <RoleGuard roles={['super_admin']}>
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
              {/* Search Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Bug Report Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsBugDialogOpen(true)}
                title="Reportar Bug ou Melhoria"
              >
                <Bug className="h-4 w-4" />
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
              {/* Navigation Links */}
              <nav className="space-y-1">
                {navigation.map((item) => (
                  item.children ? (
                    <Collapsible
                      key={item.name}
                      open={openMobileMenus[item.name] || isChildActive(item.children)}
                      onOpenChange={(open) => setOpenMobileMenus(prev => ({ ...prev, [item.name]: open }))}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div
                          className={cn(
                            "flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-base font-medium transition-smooth",
                            isChildActive(item.children)
                              ? "bg-secondary/50 text-foreground"
                              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="h-5 w-5" />
                            {item.name}
                          </div>
                          <ChevronDown 
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              (openMobileMenus[item.name] || isChildActive(item.children)) && "rotate-180"
                            )} 
                          />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-6 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-smooth",
                                isActive
                                  ? "bg-secondary text-foreground"
                                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                              )
                            }
                          >
                            <child.icon className="h-4 w-4" />
                            {child.name}
                          </NavLink>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <NavLink
                      key={item.name}
                      to={item.href!}
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
                  )
                ))}
                
                <RoleGuard roles={['super_admin']}>
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
      {/* Bug Report Dialog */}
      <BugReportDialog open={isBugDialogOpen} onOpenChange={setIsBugDialogOpen} />
    </>
  );
}
