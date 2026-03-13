import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CockpitKpis } from '@/hooks/useCockpitKpis';
import { useCockpitVinculo } from '@/hooks/useCockpitVinculo';
import { DollarSign, ShoppingBag, Users, XCircle, ReceiptText } from 'lucide-react';

const fmt  = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = new Intl.NumberFormat('pt-BR');

interface Props {
  kpis: CockpitKpis | undefined;
  isLoading: boolean;
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
      <div className="p-2 rounded-md bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
      </div>
    </div>
  );
}

export function MinhaPerformance({ kpis, isLoading }: Props) {
  const { vinculo } = useCockpitVinculo();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Minha Performance</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!kpis) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Minha Performance
          {vinculo && <span className="text-xs font-normal text-muted-foreground ml-2">#{vinculo.cod_vendedor}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Stat
          icon={<DollarSign className="h-4 w-4" />}
          label="Faturamento"
          value={fmt.format(kpis.faturamento_total)}
        />
        <Stat
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Pedidos"
          value={fmtN.format(kpis.total_pedidos)}
        />
        <Stat
          icon={<ReceiptText className="h-4 w-4" />}
          label="Ticket Médio"
          value={fmt.format(kpis.ticket_medio)}
        />
        <Stat
          icon={<Users className="h-4 w-4" />}
          label="Clientes Visitados"
          value={fmtN.format(kpis.clientes_visitados)}
        />
        <Stat
          icon={<XCircle className="h-4 w-4" />}
          label="Não-Vendas"
          value={fmtN.format(kpis.nao_vendas)}
        />
      </CardContent>
    </Card>
  );
}
