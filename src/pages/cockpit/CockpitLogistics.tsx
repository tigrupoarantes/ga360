import { useState } from 'react';
import { CockpitFiltersProvider, useCockpitFilters } from '@/contexts/CockpitFiltersContext';
import { CockpitFilters } from '@/components/cockpit/CockpitFilters';
import {
  Package, BarChart3, Trophy, Clock, Download, Copy,
  TrendingUp, Box, Hash, DollarSign, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useABCData, useMixCampeao, useLogisticsOverview, useStockPosition, useStockLots,
} from '@/hooks/cockpit/useLogisticsData';
import type { ABCItem, MixItem } from '@/lib/cockpit-types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function classColor(c: 'A' | 'B' | 'C') {
  if (c === 'A') return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
  if (c === 'B') return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
  return 'bg-red-500/15 text-red-600 border-red-500/30';
}

function exportABCToCSV(data: ABCItem[]) {
  const csv = ['SKU;Produto;Faturamento;Quantidade;% Total;% Acumulado;Classe',
    ...data.map(i => `${i.sku};${i.name};${i.revenue.toFixed(2)};${i.quantity};${i.percentOfTotal.toFixed(2)};${i.cumulativePercent.toFixed(2)};${i.classification}`)
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `curva_abc_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  URL.revokeObjectURL(url); toast.success('CSV exportado com sucesso');
}

function copyMixToClipboard(data: MixItem[]) {
  navigator.clipboard.writeText(data.map((i, idx) => `${idx + 1}. ${i.name} (${i.sku}) — ${formatCurrency(i.revenue)} — ${i.citiesCount} cidades`).join('\n'));
  toast.success('Lista copiada para área de transferência');
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-5 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /><Skeleton className="h-3 w-20" /></CardContent></Card>)}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
        <div className="p-3 rounded-full bg-destructive/10"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
        <p className="text-sm font-medium text-destructive">Erro ao carregar dados</p>
        <p className="text-xs text-muted-foreground max-w-md">{message}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card><CardContent className="p-8 flex flex-col items-center gap-3 text-center">
      <div className="p-3 rounded-full bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </CardContent></Card>
  );
}

function LocalKPICard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1"><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-bold tracking-tight">{value}</p>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
          <div className="p-2.5 rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const { overview, isLoading, isError, error } = useLogisticsOverview();
  const { abcData } = useABCData();
  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState message={error?.message || 'Erro desconhecido'} />;
  const top10 = abcData.slice(0, 10);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <LocalKPICard title="SKUs Vendidos" value={formatNumber(overview.uniqueSkus)} subtitle="Produtos distintos no período" icon={Box} />
        <LocalKPICard title="Faturamento Total" value={formatCurrency(overview.totalRevenue)} subtitle="Valor líquido no período" icon={DollarSign} />
        <LocalKPICard title="Ticket Médio / SKU" value={formatCurrency(overview.avgRevenuePerSku)} subtitle="Faturamento ÷ SKUs" icon={TrendingUp} />
        <LocalKPICard title="Top SKU" value={overview.topSku.name} subtitle={formatCurrency(overview.topSku.revenue)} icon={Trophy} />
      </div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" />Top 10 Produtos por Faturamento</CardTitle></CardHeader>
        <CardContent>{top10.length === 0 ? <EmptyState message="Nenhum dado de vendas encontrado para o período selecionado" /> : (
          <Table><TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-center w-16">Classe</TableHead></TableRow></TableHeader>
            <TableBody>{top10.map((item, idx) => (
              <TableRow key={item.sku}><TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                <TableCell><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></div></TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(item.revenue)}</TableCell>
                <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                <TableCell className="text-center"><Badge variant="outline" className={classColor(item.classification)}>{item.classification}</Badge></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}</CardContent>
      </Card>
    </div>
  );
}

function ABCTab() {
  const { abcData, summary, isLoading, isError, error } = useABCData();
  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState message={error?.message || 'Erro desconhecido'} />;
  if (abcData.length === 0) return <EmptyState message="Nenhum dado de vendas encontrado para o período" />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <LocalKPICard title="Total SKUs" value={formatNumber(summary.totalSkus)} subtitle={formatCurrency(summary.totalRevenue)} icon={Box} />
        <LocalKPICard title="Classe A (80%)" value={formatNumber(summary.classA)} subtitle={`${summary.totalSkus > 0 ? ((summary.classA / summary.totalSkus) * 100).toFixed(0) : 0}% dos SKUs`} icon={Trophy} />
        <LocalKPICard title="Classe B (80-95%)" value={formatNumber(summary.classB)} subtitle={`${summary.totalSkus > 0 ? ((summary.classB / summary.totalSkus) * 100).toFixed(0) : 0}% dos SKUs`} icon={BarChart3} />
        <LocalKPICard title="Classe C (95-100%)" value={formatNumber(summary.classC)} subtitle={`${summary.totalSkus > 0 ? ((summary.classC / summary.totalSkus) * 100).toFixed(0) : 0}% dos SKUs`} icon={Package} />
      </div>
      <Card><CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Curva ABC por Faturamento</CardTitle>
        <Button variant="outline" size="sm" onClick={() => exportABCToCSV(abcData)} className="gap-2"><Download className="h-4 w-4" />Exportar CSV</Button>
      </CardHeader>
        <CardContent><div className="max-h-[500px] overflow-y-auto"><Table>
          <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">% Total</TableHead><TableHead className="text-right">% Acum.</TableHead><TableHead className="text-center w-16">Classe</TableHead></TableRow></TableHeader>
          <TableBody>{abcData.map((item, idx) => (
            <TableRow key={item.sku}><TableCell className="text-muted-foreground">{idx + 1}</TableCell>
              <TableCell><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></div></TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(item.revenue)}</TableCell>
              <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
              <TableCell className="text-right">{item.percentOfTotal.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{item.cumulativePercent.toFixed(1)}%</TableCell>
              <TableCell className="text-center"><Badge variant="outline" className={classColor(item.classification)}>{item.classification}</Badge></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></div></CardContent>
      </Card>
    </div>
  );
}

function MixTab() {
  const { filters } = useCockpitFilters();
  const { mixItems, isLoading, isError, error } = useMixCampeao(filters.uf, 20);
  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState message={error?.message || 'Erro desconhecido'} />;
  if (mixItems.length === 0) return <EmptyState message="Nenhum dado de venda encontrado para a região selecionada" />;
  return (
    <div className="space-y-6">
      <Card><CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" />Mix Campeão {filters.uf ? `— ${filters.uf}` : '— Todas as regiões'}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Top SKUs por faturamento. Use o filtro de UF para segmentar.</p></div>
        <div className="flex items-center gap-2">
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => copyMixToClipboard(mixItems)} className="gap-2"><Copy className="h-4 w-4" />Copiar</Button></TooltipTrigger><TooltipContent>Copiar lista para clipboard</TooltipContent></Tooltip>
        </div>
      </CardHeader>
        <CardContent><Table>
          <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Cidades</TableHead></TableRow></TableHeader>
          <TableBody>{mixItems.map((item, idx) => (
            <TableRow key={item.sku}><TableCell><span className={`font-bold ${idx < 3 ? 'text-primary' : 'text-muted-foreground'}`}>{idx + 1}</span></TableCell>
              <TableCell><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></div></TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(item.revenue)}</TableCell>
              <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
              <TableCell className="text-right">{item.citiesCount}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
}

function StockTab() {
  const { data: stockItems, isLoading, isError, error } = useStockPosition();
  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState message={error?.message || 'Erro desconhecido'} />;
  if (!stockItems?.length) return <EmptyState message="Nenhum dado de estoque encontrado" />;
  return (
    <Card><CardHeader className="pb-3 flex flex-row items-center justify-between">
      <div><CardTitle className="text-base flex items-center gap-2"><Box className="h-4 w-4" />Posição de Estoque</CardTitle><p className="text-xs text-muted-foreground mt-1">Visão consolidada do estoque atual (Top 1000 itens)</p></div>
    </CardHeader>
      <CardContent><Table>
        <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Produto</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
        <TableBody>{stockItems.map((item, idx) => (
          <TableRow key={`${item.cod_produto}-${item.cod_local}`}><TableCell className="text-muted-foreground">{idx + 1}</TableCell>
            <TableCell><div><p className="font-medium">{item.desc_produto}</p><p className="text-xs text-muted-foreground">SKU: {item.cod_produto}</p></div></TableCell>
            <TableCell><Badge variant="outline">{item.desc_local} ({item.cod_local})</Badge></TableCell>
            <TableCell className="text-right font-medium">{formatNumber(item.qtd_estoque)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{formatCurrency(item.vlr_estoque)}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></CardContent>
    </Card>
  );
}

function ExpiryTab() {
  const { data: lots, isLoading, isError, error } = useStockLots();
  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState message={error?.message || 'Erro desconhecido'} />;
  if (!lots?.length) return <EmptyState message="Nenhum lote com validade encontrado" />;
  const getExpiryStatus = (dateStr: string) => {
    const diffDays = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (diffDays < 0) return { label: 'Vencido', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' };
    if (diffDays <= 30) return { label: 'Crítico (<30d)', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' };
    if (diffDays <= 90) return { label: 'Atenção (<90d)', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' };
    return { label: 'Ok', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' };
  };
  return (
    <Card><CardHeader className="pb-3 flex flex-row items-center justify-between">
      <div><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Controle de Validade (FEFO)</CardTitle><p className="text-xs text-muted-foreground mt-1">Lotes por data de vencimento (Top 1000)</p></div>
    </CardHeader>
      <CardContent><Table>
        <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Produto</TableHead><TableHead>Lote / Local</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-center">Vencimento</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
        <TableBody>{lots.map((item, idx) => {
          const status = getExpiryStatus(item.dt_validade);
          return (
            <TableRow key={`${item.cod_produto}-${item.lote}-${item.cod_local}`}><TableCell className="text-muted-foreground">{idx + 1}</TableCell>
              <TableCell><div><p className="font-medium">{item.desc_produto}</p><p className="text-xs text-muted-foreground">SKU: {item.cod_produto}</p></div></TableCell>
              <TableCell><div className="flex flex-col gap-1"><span className="text-xs font-mono bg-muted/50 px-1 py-0.5 rounded w-fit">Lote: {item.lote}</span><span className="text-xs text-muted-foreground">{item.desc_local}</span></div></TableCell>
              <TableCell className="text-right font-medium">{formatNumber(item.qtd_estoque)}</TableCell>
              <TableCell className="text-center">{new Date(item.dt_validade).toLocaleDateString('pt-BR')}</TableCell>
              <TableCell className="text-center"><Badge variant="outline" className={`border-0 ${status.color}`}>{status.label}</Badge></TableCell>
            </TableRow>
          );
        })}</TableBody>
      </Table></CardContent>
    </Card>
  );
}

function CockpitLogisticsContent() {
  const [activeTab, setActiveTab] = useState('overview');
  return (
    <div>
      <CockpitFilters />
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            Logística
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Curva ABC, Mix Campeão e análise logística baseada em vendas
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="overview" className="gap-1.5"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Visão Geral</span></TabsTrigger>
            <TabsTrigger value="abc" className="gap-1.5"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">ABC</span></TabsTrigger>
            <TabsTrigger value="mix" className="gap-1.5"><Trophy className="h-4 w-4" /><span className="hidden sm:inline">Mix Campeão</span></TabsTrigger>
            <TabsTrigger value="stock" className="gap-1.5"><Box className="h-4 w-4" /><span className="hidden sm:inline">Estoque</span></TabsTrigger>
            <TabsTrigger value="expiry" className="gap-1.5"><Clock className="h-4 w-4" /><span className="hidden sm:inline">Fefo</span></TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
          <TabsContent value="abc" className="mt-6"><ABCTab /></TabsContent>
          <TabsContent value="mix" className="mt-6"><MixTab /></TabsContent>
          <TabsContent value="stock" className="mt-6"><StockTab /></TabsContent>
          <TabsContent value="expiry" className="mt-6"><ExpiryTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function CockpitLogistics() {
  return (
    <CockpitFiltersProvider>
      <CockpitLogisticsContent />
    </CockpitFiltersProvider>
  );
}
