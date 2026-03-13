import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { PedidoItem } from '@/hooks/useCockpitPedidos';
import { useCockpitVinculo } from '@/hooks/useCockpitVinculo';

const fmtCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d?.slice(0, 10).split('-').reverse().join('/') ?? '—';

const SITUACAO_COLOR: Record<string, string> = {
  'aprovado':  'default',
  'entregue':  'default',
  'cancelado': 'destructive',
  'pendente':  'secondary',
  'faturado':  'default',
};

interface Props {
  items: PedidoItem[];
  isLoading: boolean;
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function TabelaPedidos({ items, isLoading, page, hasMore, onPageChange }: Props) {
  const { vinculo } = useCockpitVinculo();
  const isGestor = vinculo && ['supervisor', 'gerente', 'diretoria'].includes(vinculo.nivel_acesso);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-14 text-muted-foreground">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhum pedido encontrado no período selecionado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nº Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              {isGestor && <TableHead>Vendedor</TableHead>}
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Qtde</TableHead>
              <TableHead className="text-right">Preço Unit.</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>NF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={`${item.numero_pedido}-${item.sku}-${idx}`}>
                <TableCell className="text-sm whitespace-nowrap">{fmtDate(item.data)}</TableCell>
                <TableCell className="font-mono text-sm">{item.numero_pedido}</TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{item.razao_social}</p>
                </TableCell>
                {isGestor && (
                  <TableCell className="text-sm">{item.nome_vendedor}</TableCell>
                )}
                <TableCell>
                  <p className="text-sm">{item.descricao_produto}</p>
                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                </TableCell>
                <TableCell className="text-right">{item.qtde_vendida}</TableCell>
                <TableCell className="text-right">{fmtCurrency.format(item.preco_unitario_prod)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.desconto_aplicado_prod > 0 ? `-${fmtCurrency.format(item.desconto_aplicado_prod)}` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={(SITUACAO_COLOR[item.situacao_pedido?.toLowerCase()] ?? 'secondary') as any}>
                    {item.situacao_pedido ?? '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-mono">{item.nota_fiscal || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Página {page}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
