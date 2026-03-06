import { useState } from 'react';
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
import {
  Users, Target, DollarSign, Download, Copy, MapPin,
  TrendingUp, TrendingDown, ChevronRight, AlertCircle, Loader2, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CityHeatmapPoint } from '@/lib/cockpit-types';

function getHeatColor(percent: number) {
  if (percent >= 80) return 'bg-success';
  if (percent >= 60) return 'bg-warning';
  return 'bg-destructive';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value);
}

function CockpitMapContent() {
  const { selectedCompany } = useCompany();
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
  const topCities = sortedCities.slice(0, 5);
  const bottomCities = [...sortedCities].reverse().slice(0, 5);

  const handleCityClick = (city: CityHeatmapPoint) => { setSelectedCityId(city.cityId); setIsDrawerOpen(true); };

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

  return (
    <div>
      <CockpitFilters />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa de Positivação</h1>
            <p className="text-muted-foreground mt-1">Heatmap por cidade — {selectedCompany?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as typeof metric)} className="bg-muted/50 p-1 rounded-lg">
              <ToggleGroupItem value="positivacao" className="px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm">Positivação</ToggleGroupItem>
              <ToggleGroupItem value="cobertura" className="px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm">Cobertura</ToggleGroupItem>
              <ToggleGroupItem value="vendas" className="px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm">Vendas</ToggleGroupItem>
            </ToggleGroup>
            <Button className="gap-2"><Target className="h-4 w-4" />Gerar Lista de Ataque</Button>
          </div>
        </div>

        {isError && (
          <div className="card-ga360 border-destructive/50 bg-destructive/5">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div><p className="font-medium">Erro ao carregar dados do mapa</p><p className="text-sm text-muted-foreground">{error?.message}</p></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="card-ga360 h-[600px] relative">
              {isLoading ? (
                <div className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Carregando mapa...</p>
                  </div>
                </div>
              ) : cities.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma cidade encontrada</p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted rounded-lg overflow-hidden">
                  <div className="relative w-full h-full p-8">
                    {cities.slice(0, 10).map((city, index) => {
                      const value = metric === 'vendas' ? city.salesTotal : metric === 'cobertura' ? city.coveragePercent : city.positivationPercent;
                      const maxValue = metric === 'vendas' ? Math.max(...cities.map(c => c.salesTotal)) || 1 : 100;
                      const size = Math.max(32, (value / maxValue) * 80);
                      const pos = { top: `${25 + Math.floor(index / 4) * 25}%`, left: `${15 + (index % 4) * 20}%` };
                      return (
                        <button key={city.cityId} onClick={() => handleCityClick(city)}
                          className={cn('absolute rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:z-10', getHeatColor(city.positivationPercent), 'text-white font-semibold text-xs shadow-lg')}
                          style={{ width: size, height: size, top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }} title={city.cityName}>
                          {metric === 'vendas' ? `${(city.salesTotal / 1000).toFixed(0)}k` : `${city.positivationPercent}%`}
                        </button>
                      );
                    })}
                  </div>
                  <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Legenda</p>
                    <div className="flex items-center gap-4">
                      {[{ c: 'bg-success', l: '≥80%' }, { c: 'bg-warning', l: '60-79%' }, { c: 'bg-destructive', l: '<60%' }].map(({ c, l }) => (
                        <div key={l} className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${c}`} /><span className="text-xs">{l}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="card-ga360 space-y-3"><Skeleton className="h-4 w-20" />{[1, 2, 3].map(j => <div key={j} className="flex justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-12" /></div>)}</div>)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card-ga360">
                <h3 className="font-semibold text-foreground mb-3">Resumo</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Positivação média', value: `${(summary?.avgPositivation || 0).toFixed(1)}%` },
                    { label: 'Cidades mapeadas', value: String(summary?.totalCities || 0) },
                    { label: 'Vendas totais', value: formatCurrency(summary?.totalSales || 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {[
                { title: 'Top 5 Cidades', icon: TrendingUp, iconClass: 'text-success', items: topCities, valueClass: 'text-success' },
                { title: 'Precisam de Atenção', icon: TrendingDown, iconClass: 'text-destructive', items: bottomCities, valueClass: 'text-destructive' },
              ].map(({ title, icon: Icon, iconClass, items, valueClass }) => (
                <div key={title} className="card-ga360">
                  <div className="flex items-center gap-2 mb-3"><Icon className={`h-4 w-4 ${iconClass}`} /><h3 className="font-semibold text-foreground">{title}</h3></div>
                  <div className="space-y-2">
                    {items.map((city, index) => (
                      <button key={city.cityId} onClick={() => handleCityClick(city)} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted text-xs flex items-center justify-center font-medium">{index + 1}</span>
                          <span className="text-sm font-medium">{city.cityName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${valueClass}`}>{city.positivationPercent}%</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
            {selectedCity && (
              <>
                <SheetHeader className="pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div><SheetTitle className="text-xl">{selectedCity.cityName}</SheetTitle><p className="text-sm text-muted-foreground">{selectedCity.uf}</p></div>
                  </div>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <KPICard title="Positivação" value={`${cityDetail?.kpis?.positivationPercent || selectedCity.positivationPercent}%`}
                      subtitle={`${cityDetail?.kpis?.positivatedClients || selectedCity.positivatedClients} de ${cityDetail?.kpis?.baseClients || selectedCity.baseClients}`}
                      icon={<Users className="h-4 w-4" />} className="!p-4" />
                    <KPICard title="Vendas" value={formatCurrency(cityDetail?.kpis?.salesTotal || selectedCity.salesTotal)}
                      icon={<DollarSign className="h-4 w-4" />} className="!p-4" />
                  </div>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                      <TabsTrigger value="mix">Mix Ideal</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">Clientes Não Positivados</h4>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={handleCopyList} disabled={isCityLoading}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
                          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isCityLoading}><Download className="h-4 w-4 mr-1" />CSV</Button>
                        </div>
                      </div>
                      {isCityLoading ? (
                        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                      ) : cityDetail?.nonPositivatedClients?.length ? (
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader><TableRow className="bg-muted/50"><TableHead className="font-medium">Cliente</TableHead><TableHead className="font-medium">Canal</TableHead><TableHead className="font-medium text-right">Dias</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {cityDetail.nonPositivatedClients.map((client) => (
                                <TableRow key={client.clientId} className="hover:bg-muted/30">
                                  <TableCell><div><p className="font-medium text-sm">{client.clientName}</p><p className="text-xs text-muted-foreground">{client.clientCode}</p></div></TableCell>
                                  <TableCell><span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{client.channelCode}</span></TableCell>
                                  <TableCell className="text-right"><span className={cn('text-sm font-medium', (client.daysSinceLastPurchase || 0) > 30 ? 'text-destructive' : 'text-muted-foreground')}>{client.daysSinceLastPurchase || '—'}</span></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>Todos os clientes foram positivados!</p></div>
                      )}
                    </TabsContent>
                    <TabsContent value="mix" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div><h4 className="font-semibold">Top Produtos da Região</h4><p className="text-xs text-muted-foreground">Baseado no histórico de vendas desta cidade</p></div>
                        <Button variant="ghost" size="sm" onClick={handleCopyMix} disabled={isMixLoading}><Copy className="h-4 w-4 mr-1" />Copiar Mix</Button>
                      </div>
                      {isMixLoading ? (
                        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                      ) : mixItems?.length ? (
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader><TableRow className="bg-muted/50"><TableHead className="font-medium">Produto</TableHead><TableHead className="font-medium text-right">Qtd</TableHead><TableHead className="font-medium text-right">Faturamento</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {mixItems.map((item) => (
                                <TableRow key={item.sku} className="hover:bg-muted/30">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0"><Package className="h-4 w-4 text-primary" /></div>
                                      <div><p className="font-medium text-sm line-clamp-1">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></div>
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
                        <div className="text-center py-8 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>Nenhum dado de venda encontrado para esta cidade.</p></div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export default function CockpitMap() {
  return (
    <CockpitFiltersProvider>
      <CockpitMapContent />
    </CockpitFiltersProvider>
  );
}
