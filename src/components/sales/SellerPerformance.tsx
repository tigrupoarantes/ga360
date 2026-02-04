import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/external-client";
import { format } from "date-fns";
import { Users, ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SalesFiltersState {
  segment: string;
  network: string;
  line: string;
  manufacturer: string;
  supervisor: string;
}

interface SellerPerformanceProps {
  dateRange: { from: Date; to: Date };
  selectedDistributor: string;
  filters: SalesFiltersState;
}

interface SellerData {
  seller_code: string;
  seller_name: string;
  supervisor_code: string;
  supervisor_name: string;
  manager_code: string;
  manager_name: string;
  total_value: number;
  total_volume: number;
  gross_margin: number;
  margin_percent: number;
  unique_customers: number;
}

interface SupervisorGroup {
  supervisor_code: string;
  supervisor_name: string;
  manager_name: string;
  sellers: SellerData[];
  total_value: number;
  total_margin: number;
  margin_percent: number;
}

interface ManagerGroup {
  manager_code: string;
  manager_name: string;
  supervisors: SupervisorGroup[];
  total_value: number;
  total_margin: number;
  margin_percent: number;
}

export function SellerPerformance({ dateRange, selectedDistributor, filters }: SellerPerformanceProps) {
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [managerGroups, setManagerGroups] = useState<ManagerGroup[]>([]);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [totals, setTotals] = useState({
    totalValue: 0,
    totalMargin: 0,
    marginPercent: 0,
    totalSellers: 0,
    totalCustomers: 0
  });

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSellerData();
    }
  }, [selectedCompanyId, dateRange, selectedDistributor, filters]);

  const fetchSellerData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      // Fetch sales data with team info (using any to bypass type checking for new table)
      let query = (supabase as any)
        .from('sales_items')
        .select(`
          sale_value,
          quantity_sale,
          gross_margin_value,
          customer_id,
          sales_team(
            seller_code,
            seller_name,
            supervisor_code,
            supervisor_name,
            manager_code,
            manager_name
          )
        `)
        .eq('company_id', selectedCompanyId)
        .gte('order_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('order_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedDistributor !== "all") {
        query = query.eq('distributor_id', selectedDistributor);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by supervisor if set
      let filteredData = data || [];
      if (filters.supervisor !== "all") {
        filteredData = filteredData.filter((d: any) => 
          d.sales_team?.supervisor_code === filters.supervisor
        );
      }

      // Aggregate by seller
      const sellerMap: Record<string, SellerData & { customers: Set<string> }> = {};
      
      filteredData.forEach((record: any) => {
        const team = record.sales_team;
        if (!team?.seller_code) return;

        const key = team.seller_code;
        if (!sellerMap[key]) {
          sellerMap[key] = {
            seller_code: team.seller_code,
            seller_name: team.seller_name || team.seller_code,
            supervisor_code: team.supervisor_code || '-',
            supervisor_name: team.supervisor_name || team.supervisor_code || '-',
            manager_code: team.manager_code || '-',
            manager_name: team.manager_name || team.manager_code || '-',
            total_value: 0,
            total_volume: 0,
            gross_margin: 0,
            margin_percent: 0,
            unique_customers: 0,
            customers: new Set()
          };
        }
        sellerMap[key].total_value += Number(record.sale_value) || 0;
        sellerMap[key].total_volume += Number(record.quantity_sale) || 0;
        sellerMap[key].gross_margin += Number(record.gross_margin_value) || 0;
        if (record.customer_id) {
          sellerMap[key].customers.add(record.customer_id);
        }
      });

      // Calculate margin percent and unique customers
      const sellers = Object.values(sellerMap).map(seller => ({
        ...seller,
        margin_percent: seller.total_value > 0 ? (seller.gross_margin / seller.total_value) * 100 : 0,
        unique_customers: seller.customers.size
      }));

      // Group by supervisor
      const supervisorMap: Record<string, SupervisorGroup> = {};
      sellers.forEach(seller => {
        const key = seller.supervisor_code;
        if (!supervisorMap[key]) {
          supervisorMap[key] = {
            supervisor_code: seller.supervisor_code,
            supervisor_name: seller.supervisor_name,
            manager_name: seller.manager_name,
            sellers: [],
            total_value: 0,
            total_margin: 0,
            margin_percent: 0
          };
        }
        supervisorMap[key].sellers.push(seller);
        supervisorMap[key].total_value += seller.total_value;
        supervisorMap[key].total_margin += seller.gross_margin;
      });

      // Calculate supervisor margin percent
      Object.values(supervisorMap).forEach(sup => {
        sup.margin_percent = sup.total_value > 0 ? (sup.total_margin / sup.total_value) * 100 : 0;
        sup.sellers.sort((a, b) => b.total_value - a.total_value);
      });

      // Group by manager
      const managerMap: Record<string, ManagerGroup> = {};
      Object.values(supervisorMap).forEach(sup => {
        const key = sup.sellers[0]?.manager_code || '-';
        if (!managerMap[key]) {
          managerMap[key] = {
            manager_code: key,
            manager_name: sup.sellers[0]?.manager_name || key,
            supervisors: [],
            total_value: 0,
            total_margin: 0,
            margin_percent: 0
          };
        }
        managerMap[key].supervisors.push(sup);
        managerMap[key].total_value += sup.total_value;
        managerMap[key].total_margin += sup.total_margin;
      });

      // Calculate manager margin percent and sort
      const managers = Object.values(managerMap).map(mgr => ({
        ...mgr,
        margin_percent: mgr.total_value > 0 ? (mgr.total_margin / mgr.total_value) * 100 : 0
      })).sort((a, b) => b.total_value - a.total_value);

      managers.forEach(mgr => {
        mgr.supervisors.sort((a, b) => b.total_value - a.total_value);
      });

      setManagerGroups(managers);

      // Calculate totals
      const totalValue = sellers.reduce((sum, s) => sum + s.total_value, 0);
      const totalMargin = sellers.reduce((sum, s) => sum + s.gross_margin, 0);
      const allCustomers = new Set(sellers.flatMap(s => Array.from((sellerMap[s.seller_code] as any).customers)));

      setTotals({
        totalValue,
        totalMargin,
        marginPercent: totalValue > 0 ? (totalMargin / totalValue) * 100 : 0,
        totalSellers: sellers.length,
        totalCustomers: allCustomers.size
      });

      // Auto-expand first manager
      if (managers.length > 0) {
        setExpandedManagers(new Set([managers[0].manager_code]));
      }
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

  const getMarginBadge = (margin: number) => {
    if (margin >= 30) return <Badge className="bg-green-600 hover:bg-green-700">{margin.toFixed(1)}%</Badge>;
    if (margin >= 20) return <Badge className="bg-blue-600 hover:bg-blue-700">{margin.toFixed(1)}%</Badge>;
    if (margin >= 10) return <Badge className="bg-yellow-600 hover:bg-yellow-700">{margin.toFixed(1)}%</Badge>;
    return <Badge variant="destructive">{margin.toFixed(1)}%</Badge>;
  };

  const toggleManager = (code: string) => {
    const newSet = new Set(expandedManagers);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setExpandedManagers(newSet);
  };

  const toggleSupervisor = (code: string) => {
    const newSet = new Set(expandedSupervisors);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setExpandedSupervisors(newSet);
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

  if (managerGroups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Sem dados de vendedores</h3>
          <p className="text-muted-foreground text-sm">
            Sincronize os dados de vendas com equipe para ver a performance hierárquica.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Margem Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalMargin)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Margem %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.marginPercent.toFixed(1)}%</div>
            <Progress value={totals.marginPercent} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalSellers)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalCustomers)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Hierarchical View */}
      <Card>
        <CardHeader>
          <CardTitle>Hierarquia de Vendas</CardTitle>
          <CardDescription>
            Performance por Gerente → Supervisor → Vendedor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {managerGroups.map((manager) => (
              <Collapsible 
                key={manager.manager_code} 
                open={expandedManagers.has(manager.manager_code)}
                onOpenChange={() => toggleManager(manager.manager_code)}
              >
                {/* Manager Row */}
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      {expandedManagers.has(manager.manager_code) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Badge variant="outline" className="font-semibold">Gerente</Badge>
                      <span className="font-semibold">{manager.manager_name}</span>
                      <span className="text-muted-foreground text-sm">
                        ({manager.supervisors.length} supervisores)
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">{formatCurrency(manager.total_value)}</span>
                      {getMarginBadge(manager.margin_percent)}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="ml-6 mt-2 space-y-2">
                    {manager.supervisors.map((supervisor) => (
                      <Collapsible
                        key={supervisor.supervisor_code}
                        open={expandedSupervisors.has(supervisor.supervisor_code)}
                        onOpenChange={() => toggleSupervisor(supervisor.supervisor_code)}
                      >
                        {/* Supervisor Row */}
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-2 bg-background border rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                              {expandedSupervisors.has(supervisor.supervisor_code) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <Badge variant="secondary">Supervisor</Badge>
                              <span className="font-medium">{supervisor.supervisor_name}</span>
                              <span className="text-muted-foreground text-sm">
                                ({supervisor.sellers.length} vendedores)
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-medium">{formatCurrency(supervisor.total_value)}</span>
                              {getMarginBadge(supervisor.margin_percent)}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          {/* Sellers Table */}
                          <div className="ml-6 mt-2 rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">#</TableHead>
                                  <TableHead>Vendedor</TableHead>
                                  <TableHead className="text-right">Clientes</TableHead>
                                  <TableHead className="text-right">Volume</TableHead>
                                  <TableHead className="text-right">Faturamento</TableHead>
                                  <TableHead className="text-right">Margem R$</TableHead>
                                  <TableHead className="text-right">Margem %</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {supervisor.sellers.map((seller, idx) => (
                                  <TableRow key={seller.seller_code}>
                                    <TableCell className="font-medium">{idx + 1}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{seller.seller_name}</span>
                                        <span className="text-xs text-muted-foreground">{seller.seller_code}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">{formatNumber(seller.unique_customers)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(seller.total_volume)}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(seller.total_value)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(seller.gross_margin)}</TableCell>
                                    <TableCell className="text-right">
                                      {getMarginBadge(seller.margin_percent)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
