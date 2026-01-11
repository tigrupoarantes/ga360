import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Package, Users, TrendingUp, ArrowUp, ArrowDown, Minus, Calendar } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesFilters } from "./SalesFilters";
import { SalesChart } from "./SalesChart";
import { SalesTable } from "./SalesTable";
import { SellerPerformance } from "./SellerPerformance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SalesKPI {
  totalValue: number;
  totalVolume: number;
  totalCustomers: number;
  avgTicket: number;
  previousValue: number;
  previousVolume: number;
  previousCustomers: number;
}

export function SalesDashboard() {
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<SalesKPI | null>(null);
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date()
  });
  const [selectedDistributor, setSelectedDistributor] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (selectedCompanyId) {
      fetchKPIs();
    }
  }, [selectedCompanyId, dateRange, selectedDistributor]);

  const fetchKPIs = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      // Current period
      let currentQuery = supabase
        .from('sales_daily')
        .select('total_value, quantity, customers_served')
        .eq('company_id', selectedCompanyId)
        .gte('sale_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('sale_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        currentQuery = currentQuery.eq('distributor_id', selectedDistributor);
      }

      const { data: currentData, error: currentError } = await currentQuery;
      if (currentError) throw currentError;

      // Previous period (same duration before)
      const periodDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const previousFrom = subDays(dateRange.from, periodDays + 1);
      const previousTo = subDays(dateRange.from, 1);

      let previousQuery = supabase
        .from('sales_daily')
        .select('total_value, quantity, customers_served')
        .eq('company_id', selectedCompanyId)
        .gte('sale_date', format(previousFrom, 'yyyy-MM-dd'))
        .lte('sale_date', format(previousTo, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        previousQuery = previousQuery.eq('distributor_id', selectedDistributor);
      }

      const { data: previousData, error: previousError } = await previousQuery;
      if (previousError) throw previousError;

      // Calculate KPIs
      const totalValue = currentData?.reduce((sum, s) => sum + (Number(s.total_value) || 0), 0) || 0;
      const totalVolume = currentData?.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0) || 0;
      const totalCustomers = currentData?.reduce((sum, s) => sum + (s.customers_served || 0), 0) || 0;
      const avgTicket = totalCustomers > 0 ? totalValue / totalCustomers : 0;

      const previousValue = previousData?.reduce((sum, s) => sum + (Number(s.total_value) || 0), 0) || 0;
      const previousVolume = previousData?.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0) || 0;
      const previousCustomers = previousData?.reduce((sum, s) => sum + (s.customers_served || 0), 0) || 0;

      setKpi({
        totalValue,
        totalVolume,
        totalCustomers,
        avgTicket,
        previousValue,
        previousVolume,
        previousCustomers
      });
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, direction: 'stable' as const };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'stable' as const
    };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  if (!selectedCompanyId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Selecione uma empresa para ver as vendas</p>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'stable' }) => {
    switch (direction) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const valueTrend = kpi ? calculateTrend(kpi.totalValue, kpi.previousValue) : null;
  const volumeTrend = kpi ? calculateTrend(kpi.totalVolume, kpi.previousVolume) : null;
  const customersTrend = kpi ? calculateTrend(kpi.totalCustomers, kpi.previousCustomers) : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <SalesFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedDistributor={selectedDistributor}
        onDistributorChange={setSelectedDistributor}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpi?.totalValue || 0)}</div>
                {valueTrend && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendIcon direction={valueTrend.direction} />
                    <span className={valueTrend.direction === 'up' ? 'text-green-500' : valueTrend.direction === 'down' ? 'text-red-500' : ''}>
                      {valueTrend.value.toFixed(1)}%
                    </span>
                    <span>vs período anterior</span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatNumber(kpi?.totalVolume || 0)}</div>
                {volumeTrend && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendIcon direction={volumeTrend.direction} />
                    <span className={volumeTrend.direction === 'up' ? 'text-green-500' : volumeTrend.direction === 'down' ? 'text-red-500' : ''}>
                      {volumeTrend.value.toFixed(1)}%
                    </span>
                    <span>vs período anterior</span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Atendidos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatNumber(kpi?.totalCustomers || 0)}</div>
                {customersTrend && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendIcon direction={customersTrend.direction} />
                    <span className={customersTrend.direction === 'up' ? 'text-green-500' : customersTrend.direction === 'down' ? 'text-red-500' : ''}>
                      {customersTrend.value.toFixed(1)}%
                    </span>
                    <span>vs período anterior</span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpi?.avgTicket || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor médio por cliente
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="sellers">Vendedores</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SalesChart
            dateRange={dateRange}
            selectedDistributor={selectedDistributor}
          />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <SalesTable
            dateRange={dateRange}
            selectedDistributor={selectedDistributor}
          />
        </TabsContent>

        <TabsContent value="sellers" className="mt-4">
          <SellerPerformance
            dateRange={dateRange}
            selectedDistributor={selectedDistributor}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
