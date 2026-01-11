import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface SellerPerformanceProps {
  dateRange: { from: Date; to: Date };
  selectedDistributor: string;
}

interface SellerData {
  seller_code: string;
  seller_name: string | null;
  distributor_name: string;
  total_customers: number;
  active_customers: number;
  total_value: number;
  coverage: number;
}

export function SellerPerformance({ dateRange, selectedDistributor }: SellerPerformanceProps) {
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<SellerData[]>([]);
  const [totals, setTotals] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalValue: 0,
    avgCoverage: 0
  });

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSellerData();
    }
  }, [selectedCompanyId, dateRange, selectedDistributor]);

  const fetchSellerData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('sales_sellers')
        .select(`
          seller_code,
          seller_name,
          total_customers,
          active_customers,
          total_value,
          distributors!inner(name)
        `)
        .eq('company_id', selectedCompanyId)
        .gte('sale_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('sale_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        query = query.eq('distributor_id', selectedDistributor);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by seller
      const sellerMap: Record<string, SellerData> = {};
      data?.forEach(record => {
        const key = `${record.seller_code}_${(record.distributors as any)?.name}`;
        if (!sellerMap[key]) {
          sellerMap[key] = {
            seller_code: record.seller_code,
            seller_name: record.seller_name,
            distributor_name: (record.distributors as any)?.name || '',
            total_customers: 0,
            active_customers: 0,
            total_value: 0,
            coverage: 0
          };
        }
        // Take the max for customers (they're cumulative per day)
        sellerMap[key].total_customers = Math.max(sellerMap[key].total_customers, record.total_customers);
        sellerMap[key].active_customers = Math.max(sellerMap[key].active_customers, record.active_customers);
        sellerMap[key].total_value += Number(record.total_value) || 0;
      });

      // Calculate coverage and sort by value
      const sellersArray = Object.values(sellerMap).map(seller => ({
        ...seller,
        coverage: seller.total_customers > 0 ? (seller.active_customers / seller.total_customers) * 100 : 0
      })).sort((a, b) => b.total_value - a.total_value);

      setSellers(sellersArray);

      // Calculate totals
      const totalCustomers = sellersArray.reduce((sum, s) => sum + s.total_customers, 0);
      const activeCustomers = sellersArray.reduce((sum, s) => sum + s.active_customers, 0);
      const totalValue = sellersArray.reduce((sum, s) => sum + s.total_value, 0);
      const avgCoverage = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;

      setTotals({ totalCustomers, activeCustomers, totalValue, avgCoverage });
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
    }
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
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const getCoverageBadge = (coverage: number) => {
    if (coverage >= 80) return <Badge className="bg-green-500">Excelente</Badge>;
    if (coverage >= 60) return <Badge className="bg-blue-500">Bom</Badge>;
    if (coverage >= 40) return <Badge className="bg-yellow-500">Regular</Badge>;
    return <Badge variant="destructive">Baixo</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sellers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Sem dados de vendedores</h3>
          <p className="text-muted-foreground text-sm">
            Sincronize os dados de vendedores do SQL Server para ver a performance e cobertura.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalCustomers)}</div>
            <p className="text-xs text-muted-foreground">na carteira</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.activeCustomers)}</div>
            <p className="text-xs text-muted-foreground">que compraram</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cobertura Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgCoverage.toFixed(1)}%</div>
            <Progress value={totals.avgCoverage} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalValue)}</div>
            <p className="text-xs text-muted-foreground">no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Sellers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Vendedores</CardTitle>
          <CardDescription>
            Performance e cobertura por vendedor no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Distribuidora</TableHead>
                  <TableHead className="text-right">Carteira</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead>Cobertura</TableHead>
                  <TableHead className="text-right">Valor Vendido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((seller, index) => (
                  <TableRow key={`${seller.seller_code}_${seller.distributor_name}`}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{seller.seller_name || seller.seller_code}</span>
                        <span className="text-xs text-muted-foreground">{seller.seller_code}</span>
                      </div>
                    </TableCell>
                    <TableCell>{seller.distributor_name}</TableCell>
                    <TableCell className="text-right">{formatNumber(seller.total_customers)}</TableCell>
                    <TableCell className="text-right">{formatNumber(seller.active_customers)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={seller.coverage} className="w-16" />
                        <span className="text-sm font-medium w-12">{seller.coverage.toFixed(0)}%</span>
                        {getCoverageBadge(seller.coverage)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(seller.total_value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
