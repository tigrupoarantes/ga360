import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { CockpitFiltersProvider } from '@/contexts/CockpitFiltersContext';
import { useCommercialData } from '@/hooks/cockpit/useCommercialData';
import { CockpitFilters } from '@/components/cockpit/CockpitFilters';
import { Button } from '@/components/ui/button';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TrendingUp, TrendingDown, Minus, MapPin, User, Layers, Users, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';

interface RankingItem { id: string; name: string; value: number; variation: number; extra?: string; }

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value);
}

function RankingTable({ data, title, icon: Icon, showExtra = false, isLoading = false }: {
  data: RankingItem[]; title: string; icon: React.ComponentType<{ className?: string }>;
  showExtra?: boolean; isLoading?: boolean;
}) {
  return (
    <div className="card-ga360">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum dado disponível para o período</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Nome</TableHead>
              {showExtra && <TableHead className="w-20">Info</TableHead>}
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right w-24">Var.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={item.id} className="hover:bg-muted/30 cursor-pointer">
                <TableCell>
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                    index === 0 ? 'bg-primary/10 text-primary' : index === 1 ? 'bg-muted text-foreground' :
                      index === 2 ? 'bg-warning/10 text-warning' : 'bg-muted/50 text-muted-foreground'
                  )}>{index + 1}</span>
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                {showExtra && <TableCell><span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">{item.extra}</span></TableCell>}
                <TableCell className="text-right font-semibold">{formatCurrency(item.value)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {item.variation > 0 ? <TrendingUp className="h-4 w-4 text-kpi-positive" /> :
                      item.variation < 0 ? <TrendingDown className="h-4 w-4 text-kpi-negative" /> :
                        <Minus className="h-4 w-4 text-kpi-neutral" />}
                    <span className={cn('text-sm font-medium',
                      item.variation > 0 ? 'text-kpi-positive' : item.variation < 0 ? 'text-kpi-negative' : 'text-kpi-neutral'
                    )}>
                      {item.variation > 0 ? '+' : ''}{item.variation.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CockpitCommercialContent() {
  const { selectedCompany } = useCompany();
  const [chartMetric, setChartMetric] = useState<'sales' | 'positivation'>('sales');
  const { data, isLoading } = useCommercialData();

  return (
    <div>
      <CockpitFilters />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detalhe Comercial</h1>
            <p className="text-muted-foreground mt-1">Tendências e rankings — {selectedCompany?.name}</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
        </div>

        {/* Trend Chart */}
        <div className="card-ga360">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-foreground">Tendência Diária</h3>
            <Select value={chartMetric} onValueChange={(v) => setChartMetric(v as typeof chartMetric)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Vendas (R$)</SelectItem>
                <SelectItem value="positivation">Positivação (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !data?.trend.length ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Nenhum dado de vendas para o período atual
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221, 83%, 40%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(221, 83%, 40%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(v) => chartMetric === 'sales' ? `${(v / 1000).toFixed(0)}k` : `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(v: number) => chartMetric === 'sales' ? [formatCurrency(v), 'Vendas'] : [`${v}%`, 'Positivação']} />
                  <Area type="monotone" dataKey={chartMetric} stroke="hsl(221, 83%, 40%)" strokeWidth={2} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <Tabs defaultValue="city" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="city" className="gap-2 data-[state=active]:bg-background"><MapPin className="h-4 w-4" />Cidade</TabsTrigger>
            <TabsTrigger value="seller" className="gap-2 data-[state=active]:bg-background"><User className="h-4 w-4" />Vendedor</TabsTrigger>
            <TabsTrigger value="bu" className="gap-2 data-[state=active]:bg-background"><Layers className="h-4 w-4" />BU / Indústria</TabsTrigger>
            <TabsTrigger value="channel" className="gap-2 data-[state=active]:bg-background"><Users className="h-4 w-4" />Canal</TabsTrigger>
          </TabsList>
          <TabsContent value="city" className="mt-4">
            <RankingTable data={data?.cityRanking || []} title="Ranking por Cidade" icon={MapPin} showExtra isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="seller" className="mt-4">
            <RankingTable data={data?.sellerRanking || []} title="Ranking por Vendedor" icon={User} showExtra isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="bu" className="mt-4">
            <RankingTable data={data?.buRanking || []} title="Ranking por BU" icon={Layers} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="channel" className="mt-4">
            <RankingTable data={data?.channelRanking || []} title="Ranking por Canal" icon={Users} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function CockpitCommercial() {
  return (
    <CockpitFiltersProvider>
      <CockpitCommercialContent />
    </CockpitFiltersProvider>
  );
}
