import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Clock, CheckCircle2, AlertCircle, PackageCheck } from 'lucide-react';
import type { VIDocument } from '@/hooks/useVerbasIndenizatorias';
import { useD4SignBalance } from '@/hooks/useVerbasIndenizatorias';

interface Props {
  documents: VIDocument[];
  total: number;
  companyId?: string | null;
}

export function VIStatusDashboard({ documents, total, companyId }: Props) {
  const { data: balance } = useD4SignBalance(companyId ?? null);
  const stats = useMemo(() => {
    const signed = documents.filter((d) => d.d4sign_status === 'signed').length;
    const pending = documents.filter((d) =>
      ['draft', 'uploaded', 'signers_added'].includes(d.d4sign_status),
    ).length;
    const awaiting = documents.filter((d) =>
      ['sent_to_sign', 'waiting_signature'].includes(d.d4sign_status),
    ).length;
    const errors = documents.filter((d) =>
      ['error', 'expired', 'cancelled'].includes(d.d4sign_status),
    ).length;
    const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
    return { signed, pending, awaiting, errors, pct };
  }, [documents, total]);

  const cards = [
    {
      label: 'Total de documentos',
      value: total,
      icon: FileText,
      iconClass: 'text-blue-500',
      bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Aguardando assinatura',
      value: stats.awaiting,
      icon: Clock,
      iconClass: 'text-amber-500',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'Assinados',
      value: stats.signed,
      icon: CheckCircle2,
      iconClass: 'text-green-500',
      bgClass: 'bg-green-50 dark:bg-green-950/30',
      extra: total > 0 ? `${stats.pct}% do total` : undefined,
    },
    {
      label: 'Erros / Cancelados',
      value: stats.errors,
      icon: AlertCircle,
      iconClass: 'text-red-500',
      bgClass: 'bg-red-50 dark:bg-red-950/30',
    },
    ...(balance ? (() => {
      // D4Sign pode retornar em diferentes formatos dependendo do endpoint
      const raw = balance as Record<string, unknown>;
      const balanceValue = Number(
        raw.balance ?? raw.credits ?? raw.remaining ?? raw.saldo ??
        (Array.isArray(raw) && (raw as unknown[])[0] ? ((raw as unknown[])[0] as Record<string, unknown>).balance : null) ??
        0
      );
      const totalValue = Number(raw.total ?? raw.limit ?? raw.plan_limit ?? 0);
      return [{
        label: 'Saldo D4Sign',
        value: balanceValue,
        icon: PackageCheck,
        iconClass: 'text-purple-500',
        bgClass: 'bg-purple-50 dark:bg-purple-950/30',
        extra: totalValue > 0 ? `de ${totalValue.toLocaleString("pt-BR")} contratados` : undefined,
      }];
    })() : []),
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="border-none shadow-sm">
          <CardContent className={`p-4 rounded-lg ${c.bgClass}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold mt-1">{c.value}</p>
                {c.extra && (
                  <p className="text-xs text-muted-foreground mt-1">{c.extra}</p>
                )}
              </div>
              <c.icon className={`h-6 w-6 ${c.iconClass}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
