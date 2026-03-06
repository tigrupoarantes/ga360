import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import type { Alert } from '@/lib/cockpit-types';

interface AlertCardProps {
  alerts: Alert[];
  onAlertClick?: (alert: Alert) => void;
  className?: string;
}

const alertIcons = {
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
};

const alertStyles = {
  warning: 'bg-warning/10 border-warning/20 text-warning',
  error: 'bg-destructive/10 border-destructive/20 text-destructive',
  info: 'bg-primary/10 border-primary/20 text-primary',
  success: 'bg-success/10 border-success/20 text-success',
};

export function AlertCard({ alerts, onAlertClick, className }: AlertCardProps) {
  if (alerts.length === 0) {
    return (
      <div className={cn('card-ga360', className)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <h3 className="font-semibold text-foreground">Alertas do Dia</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhum alerta no momento. Tudo está funcionando normalmente.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('card-ga360', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground">Alertas do Dia</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
        </span>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => {
          const Icon = alertIcons[alert.type];
          return (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-all',
                alertStyles[alert.type],
                onAlertClick && 'cursor-pointer hover:opacity-80'
              )}
              onClick={() => onAlertClick?.(alert)}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{alert.description}</p>
              </div>
              {onAlertClick && (
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
