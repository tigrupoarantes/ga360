import { useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KPICard } from '@/components/cockpit/KPICard';
import { RankingVendedores } from '@/components/cockpit/RankingVendedores';
import { MinhaPerformance } from '@/components/cockpit/MinhaPerformance';
import { FiltrosCockpitVendas, FiltrosCockpitVendasState, getDateRange } from '@/components/cockpit/FiltrosCockpitVendas';
import { useCockpitVinculo } from '@/hooks/useCockpitVinculo';
import { useCockpitKpis, useCockpitRanking } from '@/hooks/useCockpitKpis';
import { ShoppingBag, Link2Off, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const hoje = format(new Date(), 'yyyy-MM-dd');
const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtN = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

export default function CockpitVendas() {
  const { vinculo, isLoading: vinculoLoading, hasVinculo } = useCockpitVinculo();

  const [filtros, setFiltros] = useState<FiltrosCockpitVendasState>({
    periodo: 'hoje',
    dataInicio: hoje,
    dataFim: hoje,
    codVendedorFiltro: '',
  });

  const isGestor = vinculo && ['supervisor', 'gerente', 'diretoria'].includes(vinculo.nivel_acesso);

  const { data: kpisData, isLoading: kpisLoading, error: kpisError, refetch: refetchKpis } = useCockpitKpis({
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    codVendedorFiltro: filtros.codVendedorFiltro || undefined,
  });

  const { data: rankingData, isLoading: rankingLoading, refetch: refetchRanking } = useCockpitRanking({
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
  });

  const syncPending = (kpisData as any)?.sync_pending === true;

  // Estado: carregando vínculo
  if (vinculoLoading) {
    return (
      <MainLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </MainLayout>
    );
  }

  // Estado: sem vínculo
  if (!hasVinculo) {
    return (
      <MainLayout>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <div className="p-4 rounded-full bg-muted">
            <Link2Off className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Perfil não vinculado</h2>
          <p className="text-muted-foreground max-w-sm">
            Seu usuário ainda não está associado a um código de vendedor no Datalake.
            Solicite ao administrador que configure o vínculo em{' '}
            <strong>Admin → Cockpit de Vendas</strong>.
          </p>
          <Button asChild variant="outline">
            <Link to="/admin/cockpit-vendas">Ir para configuração</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const kpis = kpisData?.kpis;
  const ranking: any[] = rankingData?.items ?? [];

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Painel de Vendas</h1>
            <p className="text-sm text-muted-foreground">Chok Distribuidora — performance comercial</p>
          </div>
        </div>

        {/* Banner: sync pendente */}
        {syncPending && (
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <RefreshCw className="h-4 w-4 text-amber-600 animate-spin" />
            <AlertDescription className="text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <span>Para ver KPIs consolidados de todos os vendedores, selecione um vendedor no filtro acima. Visão por diretoria requer sincronização prévia com o Datalake.</span>
              <Button variant="ghost" size="sm" onClick={() => { refetchKpis(); refetchRanking(); }}>
                Atualizar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Filtros */}
        <FiltrosCockpitVendas
          filtros={filtros}
          onChange={setFiltros}
          vendedores={ranking.map((r) => ({ cod: r.cod_vendedor, nome: r.nome_vendedor }))}
        />

        {/* KPI Cards */}
        {kpisError ? (
          <Card className="border-destructive">
            <CardContent className="p-4 text-destructive text-sm">
              Erro ao carregar dados: {(kpisError as Error).message}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard
              title="Faturamento"
              value={kpis ? fmtCurrency(kpis.faturamento_total) : '—'}
              isLoading={kpisLoading}
            />
            <KPICard
              title="Pedidos"
              value={kpis ? fmtN(kpis.total_pedidos) : '—'}
              isLoading={kpisLoading}
            />
            <KPICard
              title="Ticket Médio"
              value={kpis ? fmtCurrency(kpis.ticket_medio) : '—'}
              isLoading={kpisLoading}
            />
            <KPICard
              title="Clientes Visitados"
              value={kpis ? fmtN(kpis.clientes_visitados) : '—'}
              isLoading={kpisLoading}
            />
            <KPICard
              title="Cobertura"
              value={kpis?.cobertura_pct != null ? `${kpis.cobertura_pct.toFixed(1)}%` : '—'}
              isLoading={kpisLoading}
            />
            <KPICard
              title="Não-Vendas"
              value={kpis ? fmtN(kpis.nao_vendas) : '—'}
              isLoading={kpisLoading}
            />
          </div>
        )}

        {/* Gestor: Ranking de vendedores / Vendedor: Minha Performance */}
        {isGestor ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranking de Vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingVendedores items={ranking} isLoading={rankingLoading} />
            </CardContent>
          </Card>
        ) : (
          <MinhaPerformance kpis={kpis} isLoading={kpisLoading} />
        )}
      </div>
    </MainLayout>
  );
}
