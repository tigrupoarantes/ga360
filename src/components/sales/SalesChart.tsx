import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/external-client";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SalesChartProps {
  dateRange: { from: Date; to: Date };
  selectedDistributor: string;
}

interface DailySales {
  date: string;
  value: number;
  volume: number;
}

interface DistributorSales {
  name: string;
  value: number;
  volume: number;
}

interface CategorySales {
  name: string;
  value: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function SalesChart({ dateRange, selectedDistributor }: SalesChartProps) {
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailySales[]>([]);
  const [distributorData, setDistributorData] = useState<DistributorSales[]>([]);
  const [categoryData, setCategoryData] = useState<CategorySales[]>([]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchChartData();
    }
  }, [selectedCompanyId, dateRange, selectedDistributor]);

  const fetchChartData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      // Fetch sales data
      let query = supabase
        .from('sales_daily')
        .select(`
          sale_date,
          total_value,
          quantity,
          product_category,
          distributor_id,
          distributors!inner(name)
        `)
        .eq('company_id', selectedCompanyId)
        .gte('sale_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('sale_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        query = query.eq('distributor_id', selectedDistributor);
      }

      const { data: salesData, error } = await query;
      if (error) throw error;

      // Process daily data
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dailyMap: Record<string, { value: number; volume: number }> = {};
      
      days.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        dailyMap[key] = { value: 0, volume: 0 };
      });

      salesData?.forEach(sale => {
        if (dailyMap[sale.sale_date]) {
          dailyMap[sale.sale_date].value += Number(sale.total_value) || 0;
          dailyMap[sale.sale_date].volume += Number(sale.quantity) || 0;
        }
      });

      const dailyArray = Object.entries(dailyMap).map(([date, data]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
        value: data.value,
        volume: data.volume
      }));
      setDailyData(dailyArray);

      // Process distributor data
      const distMap: Record<string, { name: string; value: number; volume: number }> = {};
      salesData?.forEach(sale => {
        const distName = (sale.distributors as any)?.name || 'Outros';
        if (!distMap[distName]) {
          distMap[distName] = { name: distName, value: 0, volume: 0 };
        }
        distMap[distName].value += Number(sale.total_value) || 0;
        distMap[distName].volume += Number(sale.quantity) || 0;
      });
      setDistributorData(Object.values(distMap).sort((a, b) => b.value - a.value));

      // Process category data
      const catMap: Record<string, number> = {};
      salesData?.forEach(sale => {
        const cat = sale.product_category || 'Outros';
        catMap[cat] = (catMap[cat] || 0) + (Number(sale.total_value) || 0);
      });
      setCategoryData(
        Object.entries(catMap)
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
      {/* Daily Sales Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Vendas Diárias</CardTitle>
          <CardDescription>Evolução de faturamento e volume no período</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis yAxisId="value" tickFormatter={formatCurrency} className="text-xs" />
              <YAxis yAxisId="volume" orientation="right" tickFormatter={formatNumber} className="text-xs" />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'value' ? formatCurrency(value) : formatNumber(value),
                  name === 'value' ? 'Faturamento' : 'Volume'
                ]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
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
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distributor Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Distribuidora</CardTitle>
          <CardDescription>Comparativo de faturamento</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distributorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={formatCurrency} className="text-xs" />
              <YAxis type="category" dataKey="name" width={100} className="text-xs" />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Categoria</CardTitle>
          <CardDescription>Distribuição por categoria de produto</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {categoryData.map((entry, index) => (
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
    </div>
  );
}
