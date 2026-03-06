import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { CockpitFiltersProvider } from '@/contexts/CockpitFiltersContext';
import { useGeoHeatmap } from '@/hooks/cockpit/useGeoHeatmap';
import { useCityDetail } from '@/hooks/cockpit/useCityDetail';
import { useMixCampeao } from '@/hooks/cockpit/useLogisticsData';
import { CockpitFilters } from '@/components/cockpit/CockpitFilters';
import { KPICard } from '@/components/cockpit/KPICard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Users, Target, DollarSign, Download, Copy, MapPin,
  TrendingUp, TrendingDown, ChevronRight, AlertCircle, Loader2, Package, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CityHeatmapPoint } from '@/lib/cockpit-types';

function getHealthColor(pct: number) {
  if (pct >= 80) return 'bg-success';
  if (pct >= 60) return 'bg-warning';
  return 'bg-destructive';
}

function getHealthTextColor(pct: number) {
  if (pct >= 80) return 'text-success';
  if (pct >= 60) return 'text-warning';
  return 'text-destructive';
}

function getHealthBadge(pct: number) {
  if (pct >= 80) return { label: 'Saudável', cls: 'bg-success/10 text-success border-success/20' };
  if (pct >= 60) return { label: 'Atenção', cls: 'bg-warning/10 text-warning border-warning/20' };
  return { label: 'Crítico', cls: 'bg-destructive/10 text-destructive border-destructive/20' };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value);
}

function CockpitMapContent() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [metric, setMetric] = useState<'positivacao' | 'cobertura' | 'vendas'>('positivacao');
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: heatmapData, isLoading, isError, error } = useGeoHeatmap(metric);
  const { data: cityDetail, isLoading: isCityLoading } = useCityDetail(selectedCityId);

  const cities = heatmapData?.points || [];
  const selectedCity = cities.find(c => c.cityId === selectedCityId);
  const { mixItems, isLoading: isMixLoading } = useMixCampeao(selectedCity?.cityName, 20);
  const summary = heatmapData?.summary;

  const sortedCities = [...cities].sort((a, b) => {
    if (metric === 'vendas') return b.salesTotal - a.salesTotal;
    if (metric === 'cobertura') return b.coveragePercent - a.coveragePercent;
    return b.positivationPercent - a.positivationPercent;
  });

  const maxSales = Math.max(...cities.map(c => c.salesTotal), 1);

  const handleCityClick = (city: CityHeatmapPoint) => {
    setSelectedCityId(city.cityId);
    setIsDrawerOpen(true);
  };

  const handleExportCSV = () => {
    if (!cityDetail?.nonPositivatedClients) return;
    const csv = ['Código,Nome,Canal,Vendedor,Score,Dias sem compra',
      ...cityDetail.nonPositivatedClients.map(c =>
        `${c.clientCode},"${c.clientName}",${c.channelCode},"${c.sellerName}",${c.potentialScore},${c.daysSinceLastPurchase || ''}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `clientes-nao-positivados-${cityDetail.cityName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyList = () => {
    if (!cityDetail?.nonPositivatedClients) return;
    navigator.clipboard.writeText(cityDetail.nonPositivatedClients.map(c => `${c.clientCode} - ${c.clientName}`).join('\n'));
  };

  const handleCopyMix = () => {
    if (!mixItems) return;
    navigator.clipboard.writeText(mixItems.map(item => `${item.sku} - ${item.name} (${formatCurrency(item.revenue)})`).join('\n'));
  };

  const getDisplayValue = (city: CityHeatmapPoint) => {
    if (metric === 'vendas') return formatCurrency(city.salesTotal);
    if (metric === 'cobertura') return `${city.coveragePercent.toFixed(0)}%`;
    return `${city.positivationPercent.toFixed(0)}%`;
  };

  const getBarValue = (city: CityHeatmapPoint) => {
    if (metric === 'vendas') return (city.salesTotal / maxSales) * 100;
    if (metric === 'cobertura') return city.coveragePercent;
    return city.positivationPercent;
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/cockpit')} className="mb-4 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Mapa de Positivação</h1>
          <p className="text-muted-foreground mt-1">
            Ranking por cidade — <span className="font-medium text-foreground">{selectedCompany?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
            <ToggleGroup
              type="single"
              value={metric}
              onValueChange={(v) => v && setMetric(v as typeof metric)}
              className="bg-muted/50 p-1 rounded-lg"
            >
              <ToggleGroupItem value="positivacao" className="px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm text-sm">
                Positivação
              </ToggleGroupItem>
              <ToggleGroupItem value="cobertura" className="px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm text-sm">
                Cobertura
              </ToggleGroupItem>
              <ToggleGroupItem value="vendas" className="px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm text-sm">
                Vendas
              </ToggleGroupItem>
            </ToggleGroup>
            <Button className="gap-2">
              <Target className="h-4 w-4" />
              Lista de Ataque
            </Button>
          </div>
        </div>

        {/* ── Filtros ── */}
        <CockpitFilters />

        {/* ── Erro ── */}
        {isError && (
          <div className="card-ga360 border-destructive/50 bg-destructive/5 p-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Erro ao carregar dados do mapa</p>
                <p className="text-sm text-muted-foreground">{error?.message}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Ranking de cidades (coluna principal) ── */}
          <div className="lg:col-span-3 card-ga360">
            {/* Header do painel */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">Ranking por Cidade</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cities.length > 0 ? `${cities.length} cidades · clique para detalhes` : 'Selecione uma empresa com dados'}
                </p>
              </div>
              {/* Legenda */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span>≥80%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-warning" />
                  <span>60–79%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                  <span>&lt;60%</span>
                </div>
              </div>
            </div>

            {/* Conteúdo */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando dados das cidades…</p>
              </div>
            ) : cities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <MapPin className="h-12 w-12 opacity-20" />
                <p className="font-medium">Nenhuma cidade encontrada</p>
                <p className="text-sm opacity-70">Configure o Datalake em /cockpit/config</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
                {sortedCities.map((city, index) => {
                  const barValue = getBarValue(city);
                  const health = getHealthBadge(city.positivationPercent);

                  return (
                    <button
                      key={city.cityId}
                      onClick={() => handleCityClick(city)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 border border-transparent hover:border-border/40 transition-all group text-left"
                    >
                      {/* Rank badge */}
                      <span className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        index === 0 ? 'bg-primary text-primary-foreground'
                          : index === 1 ? 'bg-muted-foreground/15 text-foreground'
                            : index === 2 ? 'bg-warning/15 text-warning'
                              : 'bg-muted/60 text-muted-foreground'
                      )}>
                        {index + 1}
                      </span>

                      {/* Nome + barra */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{city.cityName}</span>
                            <span className="text-xs text-muted-foreground">{city.uf}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-sm font-bold', getHealthTextColor(city.positivationPercent))}>
                              {getDisplayValue(city)}
                            </span>
                            <Badge variant="outline" className={cn('text-xs px-1.5 py-0 border', health.cls)}>
                              {health.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', getHealthColor(city.positivationPercent))}
                            style={{ width: `${Math.min(barValue, 100)}%` }}
                          />
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Painel lateral ── */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="card-ga360 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  {[1, 2, 3].map(j => (
                    <div key={j} className="flex justify-between">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="card-ga360">
                <h3 className="font-semibold text-foreground mb-3">Resumo</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Positivação média', value: `${(summary?.avgPositivation || 0).toFixed(1)}%` },
                    { label: 'Cidades mapeadas',  value: String(summary?.totalCities || 0) },
                    { label: 'Vendas totais',     value: formatCurrency(summary?.totalSales || 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="font-semibold text-sm">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 */}
              {sortedCities.slice(0, 5).length > 0 && (
                <div className="card-ga360">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <h3 className="font-semibold text-foreground text-sm">Top 5 Cidades</h3>
                  </div>
                  <div className="space-y-1.5">
                    {sortedCities.slice(0, 5).map((city, i) => (
                      <button
                        key={city.cityId}
                        onClick={() => handleCityClick(city)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-muted text-xs flex items-center justify-center font-medium">{i + 1}</span>
                          <span className="text-sm font-medium">{city.cityName}</span>
                        </div>
                        <span className="text-sm font-semibold text-success">
                          {city.positivationPercent}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Precisam de atenção */}
              {sortedCities.length > 5 && (
                <div className="card-ga360">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <h3 className="font-semibold text-foreground text-sm">Precisam de Atenção</h3>
                  </div>
                  <div className="space-y-1.5">
                    {[...sortedCities].reverse().slice(0, 5).map((city, i) => (
                      <button
                        key={city.cityId}
                        onClick={() => handleCityClick(city)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-muted text-xs flex items-center justify-center font-medium">{i + 1}</span>
                          <span className="text-sm font-medium">{city.cityName}</span>
                        </div>
                        <span className="text-sm font-semibold text-destructive">
                          {city.positivationPercent}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sheet drawer de detalhe da cidade ── */}
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
            {selectedCity && (
              <>
                <SheetHeader className="pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl">{selectedCity.cityName}</SheetTitle>
                      <p className="text-sm text-muted-foreground">{selectedCity.uf}</p>
                    </div>
                    <Badge variant="outline" className={cn('ml-auto border', getHealthBadge(selectedCity.positivationPercent).cls)}>
                      {getHealthBadge(selectedCity.positivationPercent).label}
                    </Badge>
                  </div>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <KPICard
                      title="Positivação"
                      value={`${cityDetail?.kpis?.positivationPercent || selectedCity.positivationPercent}%`}
                      subtitle={`${cityDetail?.kpis?.positivatedClients || selectedCity.positivatedClients} de ${cityDetail?.kpis?.baseClients || selectedCity.baseClients}`}
                      progressValue={cityDetail?.kpis?.positivationPercent || selectedCity.positivationPercent}
                      icon={<Users className="h-4 w-4" />}
                      className="!p-4"
                    />
                    <KPICard
                      title="Vendas"
                      value={formatCurrency(cityDetail?.kpis?.salesTotal || selectedCity.salesTotal)}
                      icon={<DollarSign className="h-4 w-4" />}
                      className="!p-4"
                    />
                  </div>

                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                      <TabsTrigger value="mix">Mix Ideal</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Clientes Não Positivados</h4>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={handleCopyList} disabled={isCityLoading}>
                            <Copy className="h-4 w-4 mr-1" />Copiar
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isCityLoading}>
                            <Download className="h-4 w-4 mr-1" />CSV
                          </Button>
                        </div>
                      </div>
                      {isCityLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                      ) : cityDetail?.nonPositivatedClients?.length ? (
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-medium">Cliente</TableHead>
                                <TableHead className="font-medium">Canal</TableHead>
                                <TableHead className="font-medium text-right">Dias</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cityDetail.nonPositivatedClients.map((client) => (
                                <TableRow key={client.clientId} className="hover:bg-muted/30">
                                  <TableCell>
                                    <div>
                                      <p className="font-medium text-sm">{client.clientName}</p>
                                      <p className="text-xs text-muted-foreground">{client.clientCode}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{client.channelCode}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={cn('text-sm font-medium', (client.daysSinceLastPurchase || 0) > 30 ? 'text-destructive' : 'text-muted-foreground')}>
                                      {client.daysSinceLastPurchase || '—'}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Todos os clientes foram positivados!</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="mix" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-sm">Top Produtos da Região</h4>
                          <p className="text-xs text-muted-foreground">Baseado no histórico de vendas desta cidade</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleCopyMix} disabled={isMixLoading}>
                          <Copy className="h-4 w-4 mr-1" />Copiar Mix
                        </Button>
                      </div>
                      {isMixLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                      ) : mixItems?.length ? (
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-medium">Produto</TableHead>
                                <TableHead className="font-medium text-right">Qtd</TableHead>
                                <TableHead className="font-medium text-right">Faturamento</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mixItems.map((item) => (
                                <TableRow key={item.sku} className="hover:bg-muted/30">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                        <Package className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{item.quantity} un</TableCell>
                                  <TableCell className="text-right text-sm font-medium">{formatCurrency(item.revenue)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Nenhum dado de venda encontrado para esta cidade.</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
  );
}

export default function CockpitMap() {
  return (
    <MainLayout>
      <CockpitFiltersProvider>
        <CockpitMapContent />
      </CockpitFiltersProvider>
    </MainLayout>
  );
}
