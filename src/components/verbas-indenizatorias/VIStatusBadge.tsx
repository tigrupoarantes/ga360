import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, Send, AlertCircle, XCircle, FileText, Loader2 } from 'lucide-react';

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; className?: string }
> = {
  draft: {
    label: 'Rascunho',
    variant: 'secondary',
    icon: FileText,
  },
  uploaded: {
    label: 'Enviado D4Sign',
    variant: 'outline',
    icon: Loader2,
  },
  signers_added: {
    label: 'Signatário adicionado',
    variant: 'outline',
    icon: Loader2,
  },
  sent_to_sign: {
    label: 'Aguardando assinatura',
    variant: 'outline',
    icon: Send,
    className: 'border-amber-500 text-amber-600',
  },
  waiting_signature: {
    label: 'Aguardando assinatura',
    variant: 'outline',
    icon: Clock,
    className: 'border-amber-500 text-amber-600',
  },
  signed: {
    label: 'Assinado',
    variant: 'default',
    icon: CheckCircle2,
    className: 'bg-green-600 hover:bg-green-700',
  },
  cancelled: {
    label: 'Cancelado',
    variant: 'secondary',
    icon: XCircle,
  },
  expired: {
    label: 'Expirado',
    variant: 'destructive',
    icon: AlertCircle,
  },
  error: {
    label: 'Erro',
    variant: 'destructive',
    icon: AlertCircle,
  },
};

interface Props {
  status: string;
  className?: string;
}

export function VIStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    variant: 'secondary' as const,
    icon: FileText,
  };
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`gap-1 text-xs ${config.className ?? ''} ${className ?? ''}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
