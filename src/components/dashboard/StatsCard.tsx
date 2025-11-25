import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  variant = 'default' 
}: StatsCardProps) {
  const variantStyles = {
    default: 'border-border',
    primary: 'border-primary/20 bg-primary/5',
    secondary: 'border-secondary/20 bg-secondary/5',
    accent: 'border-accent/20 bg-accent/10',
  };

  return (
    <Card className={cn(
      "p-6 transition-smooth hover:shadow-card-hover animate-fade-in-up",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-muted-foreground">vs. mês anterior</span>
            </div>
          )}
        </div>
        <div className={cn(
          "rounded-lg p-3",
          variant === 'primary' && 'bg-primary/10',
          variant === 'secondary' && 'bg-secondary/10',
          variant === 'accent' && 'bg-accent/20',
          variant === 'default' && 'bg-muted'
        )}>
          <Icon className={cn(
            "h-6 w-6",
            variant === 'primary' && 'text-primary',
            variant === 'secondary' && 'text-secondary',
            variant === 'accent' && 'text-accent',
            variant === 'default' && 'text-muted-foreground'
          )} />
        </div>
      </div>
    </Card>
  );
}
