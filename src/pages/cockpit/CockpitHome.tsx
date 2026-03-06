import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { CockpitFiltersProvider } from '@/contexts/CockpitFiltersContext';
import { useKPISummary } from '@/hooks/cockpit/useKPISummary';
import { KPICard } from '@/components/cockpit/KPICard';
import { AlertCard } from '@/components/cockpit/AlertCard';
import { CockpitFilters } from '@/components/cockpit/CockpitFilters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, Users, Target, ShoppingCart, Receipt,
  Map, BarChart3, ArrowRight, AlertCircle,
} from 'lucide-react';
import type { Alert } from '@/lib/cockpit-types';

// Mock alerts - será substituído por alertas dinâmicos
const MOCK_ALERTS: Alert[] = [
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
    <div className="card-ga360 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

function CockpitHomeContent() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const { data: kpis, isLoading, error, isError } = useKPISummary();

  return (
    <div>
      <CockpitFilters />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cockpit</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral de {selectedCompany?.name || 'todas as empresas'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/cockpit/comercial')} className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Detalhe Comercial
            </Button>
            <Button onClick={() => navigate('/cockpit/mapa')} className="gap-2">
              <Map className="h-4 w-4" />
              Ver no Mapa
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isError && (
          <div className="card-ga360 border-destructive/50 bg-destructive/5">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Erro ao carregar KPIs</p>
                <p className="text-sm text-muted-foreground">{error?.message}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <KPILoadingSkeleton key={i} />)
          ) : kpis ? (
            <>
              <KPICard title="Vendas MTD" value={formatCurrency(kpis.salesMTD)}
                subtitle={`DTD: ${formatCurrency(kpis.salesDTD)} | WTD: ${formatCurrency(kpis.salesWTD)}`}
                variation={kpis.salesVariation} variationLabel="vs mês anterior" icon={<DollarSign className="h-5 w-5" />} />
              <KPICard title="Positivação" value={`${kpis.positivationPercent.toFixed(1)}%`}
                subtitle={`${formatNumber(kpis.positivationCount)} de ${formatNumber(kpis.positivationTotal)} clientes`}
                variation={kpis.positivationVariation} variationLabel="vs período anterior" icon={<Users className="h-5 w-5" />} />
              <KPICard title="Cobertura" value={`${kpis.coveragePercent.toFixed(1)}%`}
                subtitle={`${formatNumber(kpis.coverageCount)} de ${formatNumber(kpis.coverageTotal)} clientes`}
                variation={kpis.positivationVariation} variationLabel="vs período anterior" icon={<Target className="h-5 w-5" />}
                isProxy={kpis.coverageIsProxy} proxyTooltip="Sem dados de visita. Usando positivação como proxy." />
              <KPICard title="Pedidos" value={formatNumber(kpis.ordersCount)}
                variation={kpis.ordersVariation} variationLabel="vs período anterior" icon={<ShoppingCart className="h-5 w-5" />} />
              <KPICard title="Ticket Médio" value={formatCurrency(kpis.ticketAvg)}
                variation={kpis.ticketVariation} variationLabel="vs período anterior" icon={<Receipt className="h-5 w-5" />} />
            </>
          ) : (
            <div className="col-span-5 text-center py-8 text-muted-foreground">
              Selecione uma empresa para ver os KPIs
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AlertCard alerts={MOCK_ALERTS} onAlertClick={(alert) => {
              if (alert.metric === 'positivation' || alert.metric === 'sales') navigate('/cockpit/mapa');
            }} />
          </div>
          <div className="card-ga360">
            <h3 className="font-semibold text-foreground mb-4">Ações Rápidas</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate('/cockpit/mapa')}>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Map className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Mapa de Positivação</p>
                  <p className="text-xs text-muted-foreground">Ver heatmap por cidade</p>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate('/cockpit/mapa?action=attack-list')}>
                <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-warning" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Gerar Lista de Ataque</p>
                  <p className="text-xs text-muted-foreground">Clientes não positivados</p>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate('/cockpit/comercial')}>
                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-success" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Rankings</p>
                  <p className="text-xs text-muted-foreground">Por vendedor, cidade, BU</p>
                </div>
              </Button>
            </div>
          </div>
        </div>

        <div className="card-ga360">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Tendência de Vendas</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/cockpit/comercial')}>
              Ver detalhes <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg border border-dashed border-border">
            <p className="text-muted-foreground text-sm">Gráfico de tendência será exibido aqui</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CockpitHome() {
  return (
    <CockpitFiltersProvider>
      <CockpitHomeContent />
    </CockpitFiltersProvider>
  );
}
