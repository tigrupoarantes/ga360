import { useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FiltrosCockpitVendas, FiltrosCockpitVendasState } from '@/components/cockpit/FiltrosCockpitVendas';
import { useCockpitVinculo } from '@/hooks/useCockpitVinculo';
import { useCockpitNaoVendas } from '@/hooks/useCockpitPedidos';
import { XCircle, Link2Off, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const hoje = format(new Date(), 'yyyy-MM-dd');
const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
const PAGE_SIZE = 50;
const fmtDate = (d: string) => d?.slice(0, 10).split('-').reverse().join('/') ?? '—';

export default function CockpitNaoVendas() {
  const { isLoading: vinculoLoading, hasVinculo } = useCockpitVinculo();
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState<FiltrosCockpitVendasState>({
    periodo: 'mes',
    dataInicio: inicioMes,
    dataFim: hoje,
    codVendedorFiltro: '',
  });

  function handleFiltrosChange(f: FiltrosCockpitVendasState) {
    setFiltros(f);
    setPage(1);
  }

  const { data, isLoading, error } = useCockpitNaoVendas({
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    page,
    pageSize: PAGE_SIZE,
    codVendedorFiltro: filtros.codVendedorFiltro || undefined,
  });

  const { vinculo } = useCockpitVinculo();
  const isGestor = vinculo && ['supervisor', 'gerente', 'diretoria'].includes(vinculo.nivel_acesso);

  if (vinculoLoading) {
    return (
      <MainLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!hasVinculo) {
    return (
      <MainLayout>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <Link2Off className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Perfil não vinculado</h2>
          <p className="text-muted-foreground max-w-sm">
            Solicite ao administrador que configure o vínculo em Admin → Cockpit de Vendas.
          </p>
          <Button asChild variant="outline">
            <Link to="/admin/cockpit-vendas">Ir para configuração</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const items = data?.items ?? [];

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <XCircle className="h-6 w-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Não-Vendas</h1>
            <p className="text-sm text-muted-foreground">Clientes com ação de não-venda registrada no período</p>
          </div>
        </div>

        {/* Filtros */}
        <FiltrosCockpitVendas filtros={filtros} onChange={handleFiltrosChange} />

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Registros de Não-Venda
              {items.length > 0 && (
                <Badge variant="destructive" className="ml-2">{items.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-destructive text-sm">Erro: {(error as Error).message}</p>
            ) : isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <XCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum registro de não-venda no período.</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        {isGestor && <TableHead>Vendedor</TableHead>}
                        <TableHead>Ação</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={`${item.cod_cliente}-${item.data}-${idx}`}>
                          <TableCell className="whitespace-nowrap">{fmtDate(item.data)}</TableCell>
                          <TableCell>
                            <p className="font-medium">{item.razao_social}</p>
                            <p className="text-xs text-muted-foreground">#{item.cod_cliente}</p>
                          </TableCell>
                          {isGestor && (
                            <TableCell className="text-sm">{item.nome_vendedor}</TableCell>
                          )}
                          <TableCell>
                            <Badge variant="destructive">{item.acao_nao_venda}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.motivo_nao_venda || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Página {page}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!data?.pagination?.has_more}
                      onClick={() => setPage(page + 1)}
                    >
                      Próxima <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
