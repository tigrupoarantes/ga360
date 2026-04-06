import { useVIDocumentLogs } from '@/hooks/useVerbasIndenizatorias';
import { Loader2, FileText, Send, CheckCircle2, XCircle, RotateCcw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LogEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  created_at: string;
}

interface Props {
  documentId: string | null;
  companyId: string | null;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  created: {
    label: 'Documento gerado',
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-blue-500',
  },
  sent_to_sign: {
    label: 'Enviado para assinatura',
    icon: <Send className="h-4 w-4" />,
    color: 'bg-amber-500',
  },
  signed: {
    label: 'Assinado',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'bg-green-500',
  },
  cancelled: {
    label: 'Cancelado',
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-red-500',
  },
  resent: {
    label: 'Lembrete enviado',
    icon: <RotateCcw className="h-4 w-4" />,
    color: 'bg-purple-500',
  },
  reprocess: {
    label: 'Reprocessado',
    icon: <RotateCcw className="h-4 w-4" />,
    color: 'bg-orange-500',
  },
  error: {
    label: 'Erro',
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-destructive',
  },
};

function getActionConfig(action: string) {
  return (
    ACTION_CONFIG[action] ?? {
      label: action,
      icon: <Clock className="h-4 w-4" />,
      color: 'bg-muted-foreground',
    }
  );
}

function formatDetails(action: string, details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  if (action === 'sent_to_sign' && details.d4sign_uuid) {
    return `UUID D4Sign: ${String(details.d4sign_uuid).slice(0, 8)}...`;
  }
  if (action === 'reprocess' && details.previous_error) {
    return `Erro anterior: ${String(details.previous_error).slice(0, 100)}`;
  }
  if (action === 'error' && details.message) {
    return String(details.message);
  }
  if (action === 'signed' && details.signed_at) {
    return `Assinado em ${details.signed_at}`;
  }
  return null;
}

export function VITimelineLog({ documentId, companyId }: Props) {
  const { data: logs = [], isLoading } = useVIDocumentLogs(documentId, companyId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando histórico...
      </div>
    );
  }

  if ((logs as LogEntry[]).length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhum evento registrado para este documento.
      </p>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Linha vertical */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />

      <div className="space-y-4">
        {(logs as LogEntry[]).map((log) => {
          const config = getActionConfig(log.action);
          const detail = formatDetails(log.action, log.details);

          return (
            <div key={log.id} className="relative flex gap-3">
              {/* Ícone */}
              <div className={`absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full text-white ${config.color} shrink-0`}>
                {config.icon}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium leading-tight">{config.label}</p>
                {detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 break-all">{detail}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
