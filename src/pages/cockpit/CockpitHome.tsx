import { useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { CockpitFiltersProvider } from '@/contexts/CockpitFiltersContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { useKPISummary } from '@/hooks/cockpit/useKPISummary';
import { useCommercialData } from '@/hooks/cockpit/useCommercialData';
import { KPICard } from '@/components/cockpit/KPICard';
import { AlertCard } from '@/components/cockpit/AlertCard';
import { CockpitFilters } from '@/components/cockpit/CockpitFilters';
import { FiltrosCockpitVendas, FiltrosCockpitVendasState } from '@/components/cockpit/FiltrosCockpitVendas';
import { RankingVendedores } from '@/components/cockpit/RankingVendedores';
import { MinhaPerformance } from '@/components/cockpit/MinhaPerformance';
import { useCockpitVinculo } from '@/hooks/useCockpitVinculo';
import { useCockpitKpis, useCockpitRanking } from '@/hooks/useCockpitKpis';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DollarSign, Users, Target, ShoppingCart, Receipt, XCircle,
  Map, BarChart3, ArrowRight, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';
import type { Alert as AlertType } from '@/lib/cockpit-types';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';

// Mock alerts — será substituído por alertas dinâmicos via hook
const MOCK_ALERTS: AlertType[] = [
  { id: '1', type: 'warning', title: 'Queda de positivação em Campinas', description: 'Positivação caiu 15% vs semana passada', metric: 'positivation', value: 62, threshold: 70 },
  { id: '2', type: 'error', title: 'Meta de vendas em risco', description: 'Região Sul está 25% abaixo da meta mensal', metric: 'sales' },
  { id: '3', type: 'info', title: 'Nova BU adicionada', description: 'BU "Professional" foi ativada no sistema' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function KPILoadingSkeleton() {
  return (
    <div className="kpi-card space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

function CockpitHomeContent() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const hoje = format(new Date(), 'yyyy-MM-dd');

  // ── DAB (Datalake) ──────────────────────────────────────────
  const { vinculo, isLoading: vinculoLoading, hasVinculo } = useCockpitVinculo();

  const [filtros, setFiltros] = useState<FiltrosCockpitVendasState>({
    periodo: 'hoje',
    dataInicio: hoje,
    dataFim: hoje,
    codVendedorFiltro: '',
  });

  const isGestor = vinculo && ['supervisor', 'gerente', 'diretoria'].includes(vinculo.nivel_acesso);

  const {
    data: kpisData,
    isLoading: kpisLoading,
    error: kpisError,
    refetch: refetchKpis,
  } = useCockpitKpis({
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    codVendedorFiltro: filtros.codVendedorFiltro || undefined,
  });

  const {
    data: rankingData,
    isLoading: rankingLoading,
    refetch: refetchRanking,
  } = useCockpitRanking({
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
  });

  const syncPending = (kpisData as any)?.sync_pending === true;
  const kpis = kpisData?.kpis;
  const ranking: any[] = rankingData?.items ?? [];

  // ── Supabase (analytics complementar) ─────────────────────
  const { data: kpisSupabase, isLoading: kpisSupabaseLoading } = useKPISummary();
  const { data: trendData, isLoading: trendLoading } = useCommercialData();
  const hasTrend = !trendLoading && (trendData?.trend?.length ?? 0) > 0;

  // ── Decide qual fonte de KPIs mostrar ─────────────────────
  const useDabKpis = !vinculoLoading && hasVinculo;
  const useSupabaseKpis = !vinculoLoading && !hasVinculo;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Cockpit Comercial
          </h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-medium text-foreground">
              {selectedCompany?.name || 'Todas as empresas'}
            </span>
            {useDabKpis && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Datalake ativo
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/cockpit/comercial')} className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Rankings
          </Button>
          <Button onClick={() => navigate('/cockpit/mapa')} className="gap-2">
            <Map className="h-4 w-4" />
            Ver no Mapa
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      {vinculoLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : useDabKpis ? (
        <FiltrosCockpitVendas
          filtros={filtros}
          onChange={setFiltros}
          vendedores={ranking.map((r) => ({ cod: r.cod_vendedor, nome: r.nome_vendedor }))}
        />
      ) : (
        <CockpitFilters />
      )}

      {/* ── Banner: diretoria sem filtro de vendedor ── */}
      {syncPending && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <RefreshCw className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300 flex items-center justify-between gap-4">
            <span>
              Para ver KPIs consolidados de todos os vendedores, selecione um vendedor no filtro acima.
              A visão por diretoria requer sincronização prévia com o Datalake.
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
              onClick={() => { refetchKpis(); refetchRanking(); }}
            >
              Atualizar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── KPIs ── */}
      {vinculoLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <KPILoadingSkeleton key={i} />)}
        </div>
      ) : useDabKpis ? (
        /* KPIs do Datalake — ordem comercial: Cobertura → Campo → Financeiro */
        kpisError ? (
          <div className="card-ga360 border-destructive/50 bg-destructive/5 p-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Erro ao carregar dados do Datalake</p>
                <p className="text-sm text-muted-foreground">{(kpisError as Error).message}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard
              title="Cobertura"
              value={kpisLoading ? '...' : kpis?.cobertura_pct != null ? `${kpis.cobertura_pct.toFixed(1)}%` : '—'}
              subtitle="% clientes visitados"
              progressValue={kpis?.cobertura_pct ?? undefined}
              icon={<Target className="h-5 w-5" />}
            />
            <KPICard
              title="Visitados"
              value={kpisLoading ? '...' : kpis ? formatNumber(kpis.clientes_visitados) : '—'}
              subtitle="clientes no período"
              icon={<Users className="h-5 w-5" />}
            />
            <KPICard
              title="Não-Vendas"
              value={kpisLoading ? '...' : kpis ? formatNumber(kpis.nao_vendas) : '—'}
              subtitle="visitas sem pedido"
              icon={<XCircle className="h-5 w-5" />}
            />
            <KPICard
              title="Faturamento"
              value={kpisLoading ? '...' : kpis ? formatCurrency(kpis.faturamento_total) : '—'}
              subtitle="no período"
              icon={<DollarSign className="h-5 w-5" />}
            />
            <KPICard
              title="Pedidos"
              value={kpisLoading ? '...' : kpis ? formatNumber(kpis.total_pedidos) : '—'}
              subtitle="pedidos emitidos"
              icon={<ShoppingCart className="h-5 w-5" />}
            />
            <KPICard
              title="Ticket Médio"
              value={kpisLoading ? '...' : kpis ? formatCurrency(kpis.ticket_medio) : '—'}
              subtitle="por pedido"
              icon={<Receipt className="h-5 w-5" />}
            />
          </div>
        )
      ) : (
        /* KPIs do Supabase — fallback para empresas sem DAB */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpisSupabaseLoading ? (
            Array.from({ length: 5 }).map((_, i) => <KPILoadingSkeleton key={i} />)
          ) : kpisSupabase ? (
            <>
              <KPICard
                title="Vendas MTD"
                value={formatCurrency(kpisSupabase.salesMTD)}
                subtitle={`DTD ${formatCurrency(kpisSupabase.salesDTD)} · WTD ${formatCurrency(kpisSupabase.salesWTD)}`}
                variation={kpisSupabase.salesVariation}
                variationLabel="vs mês anterior"
                icon={<DollarSign className="h-5 w-5" />}
              />
              <KPICard
                title="Positivação"
                value={`${kpisSupabase.positivationPercent.toFixed(1)}%`}
                subtitle={`${formatNumber(kpisSupabase.positivationCount)} de ${formatNumber(kpisSupabase.positivationTotal)} clientes`}
                variation={kpisSupabase.positivationVariation}
                variationLabel="vs anterior"
                progressValue={kpisSupabase.positivationPercent}
                icon={<Users className="h-5 w-5" />}
              />
              <KPICard
                title="Cobertura"
                value={`${kpisSupabase.coveragePercent.toFixed(1)}%`}
                subtitle={`${formatNumber(kpisSupabase.coverageCount)} de ${formatNumber(kpisSupabase.coverageTotal)} clientes`}
                variation={kpisSupabase.positivationVariation}
                variationLabel="vs anterior"
                progressValue={kpisSupabase.coveragePercent}
                icon={<Target className="h-5 w-5" />}
                isProxy={kpisSupabase.coverageIsProxy}
                proxyTooltip="Sem dados de visita. Usando positivação como proxy."
              />
              <KPICard
                title="Pedidos"
                value={formatNumber(kpisSupabase.ordersCount)}
                variation={kpisSupabase.ordersVariation}
                variationLabel="vs anterior"
                icon={<ShoppingCart className="h-5 w-5" />}
              />
              <KPICard
                title="Ticket Médio"
                value={formatCurrency(kpisSupabase.ticketAvg)}
                variation={kpisSupabase.ticketVariation}
                variationLabel="vs anterior"
                icon={<Receipt className="h-5 w-5" />}
              />
            </>
          ) : (
            <div className="col-span-5 text-center py-10 text-muted-foreground">
              Selecione uma empresa para ver os KPIs
            </div>
          )}
        </div>
      )}

      {/* ── Ranking (gestor) ou Minha Performance (vendedor) ── */}
      {useDabKpis && (
        isGestor ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Ranking de Vendedores</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/cockpit/pedidos')}
                  className="gap-1 text-xs text-muted-foreground"
                >
                  Ver pedidos <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RankingVendedores items={ranking} isLoading={rankingLoading} />
            </CardContent>
          </Card>
        ) : (
          <MinhaPerformance kpis={kpis} isLoading={kpisLoading} />
        )
      )}

      {/* ── Tendência + Alertas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Tendência de Vendas */}
        <div className="lg:col-span-2 card-ga360">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Tendência de Vendas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Evolução diária no período selecionado</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/cockpit/comercial')}
              className="gap-1 text-xs"
            >
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="h-52">
            {trendLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData!.trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(263,70%,50%)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(263,70%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={42}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                    formatter={(v: number) => [formatCurrency(v), 'Vendas']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(263,70%,50%)"
                    strokeWidth={2}
                    fill="url(#trendSales)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground border border-dashed border-border rounded-lg">
                <BarChart3 className="h-8 w-8 opacity-30" />
                <p className="text-sm">Dados insuficientes para o período</p>
              </div>
            )}
          </div>
        </div>

        {/* Alertas */}
        <AlertCard alerts={MOCK_ALERTS} onAlertClick={(alert) => {
          if (alert.metric === 'positivation' || alert.metric === 'sales') navigate('/cockpit/mapa');
        }} />
      </div>

      {/* ── Ações Rápidas ── */}
      <div className="card-ga360">
        <h3 className="font-semibold text-foreground mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: 'Mapa de Positivação',
              desc: 'Ver heatmap por cidade',
              icon: Map,
              iconBg: 'bg-primary/10',
              iconColor: 'text-primary',
              href: '/cockpit/mapa',
            },
            {
              label: 'Lista de Ataque',
              desc: 'Clientes não positivados',
              icon: Target,
              iconBg: 'bg-warning/10',
              iconColor: 'text-warning',
              href: '/cockpit/mapa?action=attack-list',
            },
            {
              label: 'Pedidos do Período',
              desc: 'Detalhe de todos os pedidos',
              icon: ShoppingCart,
              iconBg: 'bg-success/10',
              iconColor: 'text-success',
              href: '/cockpit/pedidos',
            },
          ].map(({ label, desc, icon: Icon, iconBg, iconColor, href }) => (
            <Button
              key={label}
              variant="outline"
              className="h-auto justify-start gap-3 p-4 hover-lift"
              onClick={() => navigate(href)}
            >
              <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground font-normal">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </Button>
          ))}
        </div>
      </div>

    </div>
  );
}

export default function CockpitHome() {
  return (
    <MainLayout>
      <CockpitFiltersProvider>
        <CockpitHomeContent />
      </CockpitFiltersProvider>
    </MainLayout>
  );
}
