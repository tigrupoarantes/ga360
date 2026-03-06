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
  className,
  onClick,
}: KPICardProps) {
  const isPositive = variation !== undefined && variation > 0;
  const isNegative = variation !== undefined && variation < 0;
  const isNeutral = variation === 0;

  return (
    <div
      className={cn(
        'kpi-card cursor-default',
        onClick && 'cursor-pointer',
        className
      )}
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
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

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
              {isPositive && '+'}
              {variation.toFixed(1)}%
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
