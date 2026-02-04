import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/external-client";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesFiltersState {
  segment: string;
  network: string;
  line: string;
  manufacturer: string;
  supervisor: string;
}

interface SalesChartProps {
  dateRange: { from: Date; to: Date };
  selectedDistributor: string;
  filters: SalesFiltersState;
}

interface DailySales {
  date: string;
  value: number;
  volume: number;
  margin: number;
}

interface DistributorSales {
  name: string;
  value: number;
  volume: number;
}

interface LineSales {
  name: string;
  value: number;
  margin: number;
  marginPercent: number;
}

interface SegmentSales {
  name: string;
  value: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function SalesChart({ dateRange, selectedDistributor, filters }: SalesChartProps) {
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailySales[]>([]);
  const [distributorData, setDistributorData] = useState<DistributorSales[]>([]);
  const [lineData, setLineData] = useState<LineSales[]>([]);
  const [segmentData, setSegmentData] = useState<SegmentSales[]>([]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchChartData();
    }
  }, [selectedCompanyId, dateRange, selectedDistributor, filters]);

  const fetchChartData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      // Fetch sales data (using any to bypass type checking for new table)
      let query = (supabase as any)
        .from('sales_items')
        .select(`
          order_date,
          sale_value,
          quantity_sale,
          gross_margin_value,
          distributor_id,
          distributors(name),
          sales_products(line),
          sales_customers(segment)
        `)
        .eq('company_id', selectedCompanyId)
        .gte('order_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('order_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        query = query.eq('distributor_id', selectedDistributor);
      }

      const { data: salesData, error } = await query;
      if (error) throw error;

      // Apply filters
      let filteredData = salesData || [];
      
      if (filters.segment !== "all") {
        filteredData = filteredData.filter((s: any) => s.sales_customers?.segment === filters.segment);
      }
      if (filters.line !== "all") {
        filteredData = filteredData.filter((s: any) => s.sales_products?.line === filters.line);
      }

      // Process daily data
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dailyMap: Record<string, { value: number; volume: number; margin: number }> = {};
      
      days.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        dailyMap[key] = { value: 0, volume: 0, margin: 0 };
      });

      filteredData.forEach((sale: any) => {
        if (dailyMap[sale.order_date]) {
          dailyMap[sale.order_date].value += Number(sale.sale_value) || 0;
          dailyMap[sale.order_date].volume += Number(sale.quantity_sale) || 0;
          dailyMap[sale.order_date].margin += Number(sale.gross_margin_value) || 0;
        }
      });

      const dailyArray = Object.entries(dailyMap).map(([date, data]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
        value: data.value,
        volume: data.volume,
        margin: data.margin
      }));
      setDailyData(dailyArray);

      // Process distributor data
      const distMap: Record<string, { name: string; value: number; volume: number }> = {};
      filteredData.forEach((sale: any) => {
        const distName = sale.distributors?.name || 'Outros';
        if (!distMap[distName]) {
          distMap[distName] = { name: distName, value: 0, volume: 0 };
        }
        distMap[distName].value += Number(sale.sale_value) || 0;
        distMap[distName].volume += Number(sale.quantity_sale) || 0;
      });
      setDistributorData(Object.values(distMap).sort((a, b) => b.value - a.value));

      // Process line data (with margin)
      const lineMap: Record<string, { value: number; margin: number }> = {};
      filteredData.forEach((sale: any) => {
        const line = sale.sales_products?.line || 'Outros';
        if (!lineMap[line]) {
          lineMap[line] = { value: 0, margin: 0 };
        }
        lineMap[line].value += Number(sale.sale_value) || 0;
        lineMap[line].margin += Number(sale.gross_margin_value) || 0;
      });
      setLineData(
        Object.entries(lineMap)
          .map(([name, data]) => ({ 
            name, 
            value: data.value,
            margin: data.margin,
            marginPercent: data.value > 0 ? (data.margin / data.value) * 100 : 0
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
      );

      // Process segment data
      const segMap: Record<string, number> = {};
      filteredData.forEach((sale: any) => {
        const seg = sale.sales_customers?.segment || 'Outros';
        segMap[seg] = (segMap[seg] || 0) + (Number(sale.sale_value) || 0);
      });
      setSegmentData(
        Object.entries(segMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      );

    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
    return `R$ ${value.toFixed(0)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Daily Sales Chart with Margin */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Vendas Diárias</CardTitle>
          <CardDescription>Evolução de faturamento, volume e margem no período</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis yAxisId="value" tickFormatter={formatCurrency} className="text-xs" />
              <YAxis yAxisId="volume" orientation="right" tickFormatter={formatNumber} className="text-xs" />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'volume' ? formatNumber(value) : formatCurrency(value),
                  name === 'value' ? 'Faturamento' : name === 'margin' ? 'Margem' : 'Volume'
                ]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Area
                yAxisId="value"
                type="monotone"
                dataKey="margin"
                name="Margem"
                fill="hsl(var(--chart-3))"
                fillOpacity={0.3}
                stroke="hsl(var(--chart-3))"
                strokeWidth={1}
              />
              <Line 
                yAxisId="value"
                type="monotone" 
                dataKey="value" 
                name="Faturamento"
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                yAxisId="volume"
                type="monotone" 
                dataKey="volume" 
                name="Volume"
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Margin by Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Margem por Linha</CardTitle>
          <CardDescription>Faturamento e margem % por linha de produto</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={lineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={formatCurrency} className="text-xs" />
              <YAxis type="category" dataKey="name" width={80} className="text-xs" />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'marginPercent' ? `${value.toFixed(1)}%` : formatCurrency(value),
                  name === 'value' ? 'Faturamento' : 'Margem %'
                ]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="value" name="Faturamento" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Segment Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Segmento</CardTitle>
          <CardDescription>Distribuição por segmento de cliente</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={segmentData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {segmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distributor Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Vendas por Distribuidora</CardTitle>
          <CardDescription>Comparativo de faturamento por distribuidora</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distributorData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={formatCurrency} className="text-xs" />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
