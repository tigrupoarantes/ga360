import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Building2,
  Users,
  Shield,
  UserCheck,
  Database,
  Bug,
  Plug,
  PenLine,
  Settings,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MapPin,
  BarChart2,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Organização',
    items: [
      { label: 'Estrutura', icon: Building2, href: '/admin/estrutura' },
      { label: 'Empresas', icon: LayoutGrid, href: '/admin/empresas' },
      { label: 'Áreas', icon: MapPin, href: '/admin/areas' },
    ],
  },
  {
    title: 'Pessoas',
    items: [
      { label: 'Usuários', icon: Users, href: '/admin/users' },
      { label: 'Permissões', icon: Shield, href: '/admin/permissions' },
      { label: 'Funcionários', icon: UserCheck, href: '/admin/employees' },
    ],
  },
  {
    title: 'Integrações',
    items: [
      { label: 'Datalake', icon: Database, href: '/admin/datalake' },
      { label: 'API & Integrações', icon: Plug, href: '/admin/api-keys' },
      { label: 'D4Sign', icon: PenLine, href: '/admin/d4sign' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Configurações', icon: Settings, href: '/admin/settings' },
      { label: 'Bugs & Melhorias', icon: Bug, href: '/admin/bugs' },
      { label: 'Cockpit Vendas', icon: BarChart2, href: '/admin/cockpit-vendas' },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem('admin-sidebar-expanded');
    if (stored !== null) return stored === 'true';
    return window.innerWidth >= 1024;
  });

  useEffect(() => {
    localStorage.setItem('admin-sidebar-expanded', String(expanded));
  }, [expanded]);

  function isActive(href: string) {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  }

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 border-r border-border/50 bg-card/50 backdrop-blur-sm',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        expanded ? 'w-56' : 'w-16',
      )}
    >
      {/* Toggle button */}
      <div className={cn(
        'flex items-center border-b border-border/50 h-12 px-2',
        expanded ? 'justify-end' : 'justify-center',
      )}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={expanded ? 'Colapsar menu' : 'Expandir menu'}
        >
          {expanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-1">
            {/* Group label — only when expanded */}
            {expanded && (
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {group.title}
              </p>
            )}
            {!expanded && <div className="mx-2 my-1 h-px bg-border/50" />}

            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              const button = (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    'w-full flex items-center gap-3 text-sm font-medium rounded-md transition-colors',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    expanded ? 'px-3 py-2 mx-1' : 'justify-center py-2 mx-1',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                  style={{ width: expanded ? 'calc(100% - 8px)' : 'calc(100% - 8px)' }}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                  {expanded && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {active && expanded && (
                    <span className="ml-auto w-1 h-4 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );

              if (!expanded) {
                return (
                  <Tooltip key={item.href} delayDuration={100}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return button;
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
