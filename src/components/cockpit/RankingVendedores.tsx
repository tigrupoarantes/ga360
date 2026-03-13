import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';

interface RankingItem {
  cod_vendedor: string;
  nome_vendedor: string;
  faturamento: number;
  total_pedidos: number;
  nao_vendas: number;
}

interface Props {
  items: RankingItem[];
  isLoading: boolean;
}

function positionBadge(pos: number) {
  if (pos === 1) return <Badge className="bg-yellow-500 text-white w-7 h-7 rounded-full flex items-center justify-center">1</Badge>;
  if (pos === 2) return <Badge className="bg-gray-400 text-white w-7 h-7 rounded-full flex items-center justify-center">2</Badge>;
  if (pos === 3) return <Badge className="bg-amber-700 text-white w-7 h-7 rounded-full flex items-center justify-center">3</Badge>;
  return <span className="text-muted-foreground text-sm w-7 text-center">{pos}</span>;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function RankingVendedores({ items, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>Nenhum dado de vendas no período selecionado.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead className="text-right">Faturamento</TableHead>
          <TableHead className="text-right">Pedidos</TableHead>
          <TableHead className="text-right">Não-Vendas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, idx) => (
          <TableRow key={item.cod_vendedor}>
            <TableCell>{positionBadge(idx + 1)}</TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{item.nome_vendedor}</p>
                <p className="text-xs text-muted-foreground">#{item.cod_vendedor}</p>
              </div>
            </TableCell>
            <TableCell className="text-right font-semibold">{fmt.format(item.faturamento)}</TableCell>
            <TableCell className="text-right">{item.total_pedidos}</TableCell>
            <TableCell className="text-right">
              {item.nao_vendas > 0 ? (
                <Badge variant="destructive">{item.nao_vendas}</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
