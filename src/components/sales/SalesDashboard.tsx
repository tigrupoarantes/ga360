import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/external-client";
import { DollarSign, Package, Users, TrendingUp, ArrowUp, ArrowDown, Minus, Calendar, Percent } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesFilters } from "./SalesFilters";
import { SalesChart } from "./SalesChart";
import { SalesTable } from "./SalesTable";
import { SellerPerformance } from "./SellerPerformance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SalesKPI {
  totalValue: number;
  totalVolume: number;
  uniqueCustomers: number;
  avgTicket: number;
  grossMarginValue: number;
  grossMarginPercent: number;
  previousValue: number;
  previousVolume: number;
  previousCustomers: number;
  previousMargin: number;
}

interface SalesFiltersState {
  segment: string;
  network: string;
  line: string;
  manufacturer: string;
  supervisor: string;
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
  const [filters, setFilters] = useState<SalesFiltersState>({
    segment: "all",
    network: "all",
    line: "all",
    manufacturer: "all",
    supervisor: "all"
  });
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (selectedCompanyId) {
      fetchKPIs();
    }
  }, [selectedCompanyId, dateRange, selectedDistributor, filters]);

  const fetchKPIs = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      // Build base query for sales_items (using any to bypass type checking for new table)
      let query = (supabase as any)
        .from('sales_items')
        .select('sale_value, quantity_sale, customer_id, gross_margin_value, product_id, team_id')
        .eq('company_id', selectedCompanyId)
        .gte('order_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('order_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        query = query.eq('distributor_id', selectedDistributor);
      }

      const { data: currentData, error: currentError } = await query;
      if (currentError) throw currentError;

      // Filter data based on advanced filters
      let filteredData = currentData || [];

      // Apply filters that require JOINs
      if (filters.segment !== "all" || filters.network !== "all") {
        const customerIds = filteredData.map((d: any) => d.customer_id).filter(Boolean);
        if (customerIds.length > 0) {
          let customerQuery = (supabase as any)
            .from('sales_customers')
            .select('id')
            .in('id', customerIds);
          
          if (filters.segment !== "all") {
            customerQuery = customerQuery.eq('segment', filters.segment);
          }
          if (filters.network !== "all") {
            customerQuery = customerQuery.eq('network', filters.network);
          }

          const { data: validCustomers } = await customerQuery;
          const validCustomerIds = new Set(validCustomers?.map((c: any) => c.id) || []);
          filteredData = filteredData.filter((d: any) => validCustomerIds.has(d.customer_id));
        }
      }

      if (filters.line !== "all" || filters.manufacturer !== "all") {
        const productIds = filteredData.map((d: any) => d.product_id).filter(Boolean);
        if (productIds.length > 0) {
          let productQuery = (supabase as any)
            .from('sales_products')
            .select('id')
            .in('id', productIds);
          
          if (filters.line !== "all") {
            productQuery = productQuery.eq('line', filters.line);
          }
          if (filters.manufacturer !== "all") {
            productQuery = productQuery.eq('manufacturer', filters.manufacturer);
          }

          const { data: validProducts } = await productQuery;
          const validProductIds = new Set(validProducts?.map((p: any) => p.id) || []);
          filteredData = filteredData.filter((d: any) => validProductIds.has(d.product_id));
        }
      }

      if (filters.supervisor !== "all") {
        const teamIds = filteredData.map((d: any) => d.team_id).filter(Boolean);
        if (teamIds.length > 0) {
          const { data: validTeams } = await (supabase as any)
            .from('sales_team')
            .select('id')
            .in('id', teamIds)
            .eq('supervisor_code', filters.supervisor);

          const validTeamIds = new Set(validTeams?.map((t: any) => t.id) || []);
          filteredData = filteredData.filter((d: any) => validTeamIds.has(d.team_id));
        }
      }

      // Calculate current period KPIs
      const totalValue = filteredData.reduce((sum: number, s: any) => sum + (Number(s.sale_value) || 0), 0);
      const totalVolume = filteredData.reduce((sum: number, s: any) => sum + (Number(s.quantity_sale) || 0), 0);
      const uniqueCustomerIds = new Set(filteredData.map((s: any) => s.customer_id).filter(Boolean));
      const uniqueCustomers = uniqueCustomerIds.size;
      const avgTicket = uniqueCustomers > 0 ? totalValue / uniqueCustomers : 0;
      const grossMarginValue = filteredData.reduce((sum: number, s: any) => sum + (Number(s.gross_margin_value) || 0), 0);
      const grossMarginPercent = totalValue > 0 ? (grossMarginValue / totalValue) * 100 : 0;

      // Previous period for comparison
      const periodDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const previousFrom = subDays(dateRange.from, periodDays + 1);
      const previousTo = subDays(dateRange.from, 1);

      let previousQuery = (supabase as any)
        .from('sales_items')
        .select('sale_value, quantity_sale, customer_id, gross_margin_value')
        .eq('company_id', selectedCompanyId)
        .gte('order_date', format(previousFrom, 'yyyy-MM-dd'))
        .lte('order_date', format(previousTo, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        previousQuery = previousQuery.eq('distributor_id', selectedDistributor);
      }

      const { data: previousData } = await previousQuery;

      const previousValue = previousData?.reduce((sum: number, s: any) => sum + (Number(s.sale_value) || 0), 0) || 0;
      const previousVolume = previousData?.reduce((sum: number, s: any) => sum + (Number(s.quantity_sale) || 0), 0) || 0;
      const previousCustomerIds = new Set(previousData?.map((s: any) => s.customer_id).filter(Boolean) || []);
      const previousCustomers = previousCustomerIds.size;
      const previousMarginValue = previousData?.reduce((sum: number, s: any) => sum + (Number(s.gross_margin_value) || 0), 0) || 0;
      const previousMargin = previousValue > 0 ? (previousMarginValue / previousValue) * 100 : 0;

      setKpi({
        totalValue,
        totalVolume,
        uniqueCustomers,
        avgTicket,
        grossMarginValue,
        grossMarginPercent,
        previousValue,
        previousVolume,
        previousCustomers,
        previousMargin
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
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const valueTrend = kpi ? calculateTrend(kpi.totalValue, kpi.previousValue) : null;
  const volumeTrend = kpi ? calculateTrend(kpi.totalVolume, kpi.previousVolume) : null;
  const customersTrend = kpi ? calculateTrend(kpi.uniqueCustomers, kpi.previousCustomers) : null;
  const marginTrend = kpi ? calculateTrend(kpi.grossMarginPercent, kpi.previousMargin) : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <SalesFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedDistributor={selectedDistributor}
        onDistributorChange={setSelectedDistributor}
        selectedSegment={filters.segment}
        onSegmentChange={(v) => setFilters(f => ({ ...f, segment: v }))}
        selectedNetwork={filters.network}
        onNetworkChange={(v) => setFilters(f => ({ ...f, network: v }))}
        selectedLine={filters.line}
        onLineChange={(v) => setFilters(f => ({ ...f, line: v }))}
        selectedManufacturer={filters.manufacturer}
        onManufacturerChange={(v) => setFilters(f => ({ ...f, manufacturer: v }))}
        selectedSupervisor={filters.supervisor}
        onSupervisorChange={(v) => setFilters(f => ({ ...f, supervisor: v }))}
      />

      {/* KPI Cards - 6 cards in 3x2 grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    <span className={valueTrend.direction === 'up' ? 'text-green-600' : valueTrend.direction === 'down' ? 'text-destructive' : ''}>
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
                    <span className={volumeTrend.direction === 'up' ? 'text-green-600' : volumeTrend.direction === 'down' ? 'text-destructive' : ''}>
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
            <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatNumber(kpi?.uniqueCustomers || 0)}</div>
                {customersTrend && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendIcon direction={customersTrend.direction} />
                    <span className={customersTrend.direction === 'up' ? 'text-green-600' : customersTrend.direction === 'down' ? 'text-destructive' : ''}>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Bruta R$</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpi?.grossMarginValue || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lucro bruto no período
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Bruta %</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{(kpi?.grossMarginPercent || 0).toFixed(1)}%</div>
                {marginTrend && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendIcon direction={marginTrend.direction} />
                    <span className={marginTrend.direction === 'up' ? 'text-green-600' : marginTrend.direction === 'down' ? 'text-destructive' : ''}>
                      {marginTrend.value.toFixed(1)}pp
                    </span>
                    <span>vs período anterior</span>
                  </p>
                )}
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
            filters={filters}
          />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <SalesTable
            dateRange={dateRange}
            selectedDistributor={selectedDistributor}
            filters={filters}
          />
        </TabsContent>

        <TabsContent value="sellers" className="mt-4">
          <SellerPerformance
            dateRange={dateRange}
            selectedDistributor={selectedDistributor}
            filters={filters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
