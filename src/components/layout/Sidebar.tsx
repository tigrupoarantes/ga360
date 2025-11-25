import { NavLink } from "react-router-dom";
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
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/auth/RoleGuard";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Reuniões', href: '/reunioes', icon: Users },
  { name: 'Processos', href: '/processos', icon: FileText },
  { name: 'Tarefas', href: '/tarefas', icon: ListTodo },
  { name: 'Calendário', href: '/calendario', icon: Calendar },
  { name: 'Trade Marketing', href: '/trade', icon: ShoppingCart },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
];

const ceoNavigation = [
  { name: 'Administração', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const { profile, role, signOut } = useAuth();

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : 'Usuário';

  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : 'U';

  const roleDisplay = role === 'ceo' ? 'CEO'
    : role === 'diretor' ? 'Diretor'
    : role === 'gerente' ? 'Gerente'
    : 'Colaborador';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border animate-fade-in">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <Target className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground">GA 360</h1>
            <p className="text-xs text-sidebar-foreground/70">Gestão Estratégica</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => (
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

          <RoleGuard roles={['ceo']}>
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
