import { useNavigate } from 'react-router-dom';
import { useConnectionMonitor, type ConnectionStatus } from '@/hooks/cockpit/useConnectionMonitor';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

const statusConfig: Record<ConnectionStatus, { color: string; pulse: boolean; label: string }> = {
  connected: { color: 'bg-emerald-500', pulse: true, label: 'Datalake' },
  disconnected: { color: 'bg-red-500', pulse: false, label: 'Offline' },
  checking: { color: 'bg-amber-500', pulse: false, label: 'Verificando...' },
  unconfigured: { color: 'bg-gray-400', pulse: false, label: 'Não configurado' },
};

export function ConnectionStatusBadge() {
  const navigate = useNavigate();
  const { status, message, lastCheckedAt, checkNow } = useConnectionMonitor();
  const config = statusConfig[status];

  const formattedTime = lastCheckedAt
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastCheckedAt)
    : 'Nunca';

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          onClick={() => navigate('/cockpit/config')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200',
            'hover:bg-muted/80 cursor-pointer text-sm',
            status === 'disconnected' && 'bg-red-50 dark:bg-red-950/30',
          )}
        >
          <span className="relative flex h-2.5 w-2.5">
            {config.pulse && (
              <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', config.color)} />
            )}
            {status === 'checking' ? (
              <RefreshCw className="h-2.5 w-2.5 text-amber-500 animate-spin" />
            ) : (
              <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', config.color)} />
            )}
          </span>
          <span className={cn(
            'text-xs font-medium',
            status === 'connected' && 'text-emerald-700 dark:text-emerald-400',
            status === 'disconnected' && 'text-red-700 dark:text-red-400',
            status === 'checking' && 'text-amber-700 dark:text-amber-400',
            status === 'unconfigured' && 'text-muted-foreground',
          )}>
            {config.label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-sm">{message}</p>
          <p className="text-xs text-muted-foreground">Última verificação: {formattedTime}</p>
          <p className="text-xs text-muted-foreground">Clique para ir às configurações</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
