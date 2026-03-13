import { useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabelaPedidos } from '@/components/cockpit/TabelaPedidos';
import { FiltrosCockpitVendas, FiltrosCockpitVendasState } from '@/components/cockpit/FiltrosCockpitVendas';
import { useCockpitVinculo } from '@/hooks/useCockpitVinculo';
import { useCockpitPedidos } from '@/hooks/useCockpitPedidos';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Link2Off } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const hoje = format(new Date(), 'yyyy-MM-dd');
const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
const PAGE_SIZE = 50;

export default function CockpitPedidos() {
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
    setPage(1); // reset paginação ao mudar filtros
  }

  const { data, isLoading, error } = useCockpitPedidos({
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    page,
    pageSize: PAGE_SIZE,
    codVendedorFiltro: filtros.codVendedorFiltro || undefined,
  });

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

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-sm text-muted-foreground">Listagem detalhada de pedidos do período</p>
          </div>
        </div>

        {/* Filtros */}
        <FiltrosCockpitVendas filtros={filtros} onChange={handleFiltrosChange} />

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Pedidos</span>
              {data?.pagination && (
                <span className="text-xs font-normal text-muted-foreground">
                  Página {data.pagination.page}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-destructive text-sm">Erro ao carregar pedidos: {(error as Error).message}</p>
            ) : (
              <TabelaPedidos
                items={data?.items ?? []}
                isLoading={isLoading}
                page={page}
                hasMore={data?.pagination?.has_more ?? false}
                onPageChange={setPage}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
