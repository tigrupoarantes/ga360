import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  CheckCheck
} from "lucide-react";

export type ECStatus = 'pending' | 'in_progress' | 'at_risk' | 'overdue' | 'completed' | 'reviewed';

interface ECStatusBadgeProps {
  status: ECStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
}

const statusConfig: Record<ECStatus, { 
  label: string; 
  icon: React.ElementType; 
  className: string;
}> = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
  },
  in_progress: {
    label: 'Em Andamento',
    icon: Loader2,
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  at_risk: {
    label: 'Em Risco',
    icon: AlertTriangle,
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  },
  overdue: {
    label: 'Atrasado',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  completed: {
    label: 'Concluído',
    icon: CheckCircle2,
    className: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  reviewed: {
    label: 'Revisado',
    icon: CheckCheck,
    className: 'bg-green-600/10 text-green-700 border-green-600/20',
  },
};

export function ECStatusBadge({ 
  status, 
  size = 'md', 
  showIcon = true, 
  showLabel = true 
}: ECStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'font-medium flex items-center gap-1',
        config.className,
        sizeClasses[size]
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], status === 'in_progress' && 'animate-spin')} />}
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}
