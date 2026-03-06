import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variation?: number;
  variationLabel?: string;
  icon?: React.ReactNode;
  isProxy?: boolean;
  proxyTooltip?: string;
  /** 0-100 → exibe barra de progresso colorida abaixo do valor */
  progressValue?: number;
  className?: string;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  subtitle,
  variation,
  variationLabel,
  icon,
  isProxy,
  proxyTooltip = 'Valor estimado (proxy)',
  progressValue,
  className,
  onClick,
}: KPICardProps) {
  const isPositive = variation !== undefined && variation > 0;
  const isNegative = variation !== undefined && variation < 0;
  const isNeutral = variation === 0;

  // Cor do ícone reflete saúde do indicador
  const iconBg =
    variation === undefined
      ? 'bg-primary/10 text-primary'
      : variation > 0
        ? 'bg-success/10 text-success'
        : variation < -5
          ? 'bg-destructive/10 text-destructive'
          : 'bg-warning/10 text-warning';

  // Cor da barra de progresso
  const barColor =
    progressValue === undefined
      ? ''
      : progressValue >= 80
        ? 'bg-success'
        : progressValue >= 60
          ? 'bg-warning'
          : 'bg-destructive';

  return (
    <div
      className={cn('kpi-card cursor-default', onClick && 'cursor-pointer hover-lift', className)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isProxy && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent>{proxyTooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {icon && (
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center transition-colors', iconBg)}>
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      {progressValue !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', barColor)}
              style={{ width: `${Math.min(Math.max(progressValue, 0), 100)}%` }}
            />
          </div>
        </div>
      )}

      {variation !== undefined && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            {isPositive && <TrendingUp className="h-4 w-4 text-kpi-positive" />}
            {isNegative && <TrendingDown className="h-4 w-4 text-kpi-negative" />}
            {isNeutral && <Minus className="h-4 w-4 text-kpi-neutral" />}
            <span
              className={cn(
                'text-sm font-medium',
                isPositive && 'text-kpi-positive',
                isNegative && 'text-kpi-negative',
                isNeutral && 'text-kpi-neutral'
              )}
            >
              {isPositive && '+'}{variation.toFixed(1)}%
            </span>
            {variationLabel && (
              <span className="text-xs text-muted-foreground">{variationLabel}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
