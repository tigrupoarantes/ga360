import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/external-client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface SalesFiltersState {
  segment: string;
  network: string;
  line: string;
  manufacturer: string;
  supervisor: string;
}

interface SalesTableProps {
  dateRange: { from: Date; to: Date };
  selectedDistributor: string;
  filters: SalesFiltersState;
}

interface SaleRecord {
  id: string;
  order_date: string;
  order_number: string | null;
  sale_value: number;
  quantity_sale: number;
  gross_margin_percent: number;
  customer_name: string;
  customer_segment: string;
  product_name: string;
  product_line: string;
  manufacturer: string;
  seller_name: string;
  distributor_name: string;
}

const PAGE_SIZE = 20;

export function SalesTable({ dateRange, selectedDistributor, filters }: SalesTableProps) {
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (selectedCompanyId) {
      setPage(0);
      fetchSales();
    }
  }, [selectedCompanyId, dateRange, selectedDistributor, filters, search]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSales();
    }
  }, [page]);

  const fetchSales = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      // Build query with JOINs (using any to bypass type checking for new table)
      let query = (supabase as any)
        .from('sales_items')
        .select(`
          id,
          order_date,
          order_number,
          sale_value,
          quantity_sale,
          gross_margin_percent,
          sales_customers(name, segment),
          sales_products(name, line, manufacturer),
          sales_team(seller_name),
          distributors(name)
        `, { count: 'exact' })
        .eq('company_id', selectedCompanyId)
        .gte('order_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('order_date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('order_date', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedDistributor !== "all") {
        query = query.eq('distributor_id', selectedDistributor);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Map data to flat structure
      let salesData: SaleRecord[] = (data || []).map((sale: any) => ({
        id: sale.id,
        order_date: sale.order_date,
        order_number: sale.order_number,
        sale_value: Number(sale.sale_value) || 0,
        quantity_sale: Number(sale.quantity_sale) || 0,
        gross_margin_percent: Number(sale.gross_margin_percent) || 0,
        customer_name: sale.sales_customers?.name || '-',
        customer_segment: sale.sales_customers?.segment || '-',
        product_name: sale.sales_products?.name || '-',
        product_line: sale.sales_products?.line || '-',
        manufacturer: sale.sales_products?.manufacturer || '-',
        seller_name: sale.sales_team?.seller_name || '-',
        distributor_name: sale.distributors?.name || '-'
      }));

      // Apply client-side filters
      if (filters.segment !== "all") {
        salesData = salesData.filter(s => s.customer_segment === filters.segment);
      }
      if (filters.line !== "all") {
        salesData = salesData.filter(s => s.product_line === filters.line);
      }
      if (filters.manufacturer !== "all") {
        salesData = salesData.filter(s => s.manufacturer === filters.manufacturer);
      }

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        salesData = salesData.filter(s => 
          s.customer_name.toLowerCase().includes(searchLower) ||
          s.product_name.toLowerCase().includes(searchLower) ||
          s.seller_name.toLowerCase().includes(searchLower) ||
          (s.order_number && s.order_number.toLowerCase().includes(searchLower))
        );
      }

      setSales(salesData);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getMarginBadge = (margin: number) => {
    const percent = margin * 100;
    if (percent >= 30) return <Badge className="bg-green-600 hover:bg-green-700">{formatPercent(margin)}</Badge>;
    if (percent >= 15) return <Badge className="bg-blue-600 hover:bg-blue-700">{formatPercent(margin)}</Badge>;
    if (percent >= 0) return <Badge className="bg-yellow-600 hover:bg-yellow-700">{formatPercent(margin)}</Badge>;
    return <Badge variant="destructive">{formatPercent(margin)}</Badge>;
  };

  const exportCSV = () => {
    const headers = ['Data', 'Pedido', 'Distribuidora', 'Cliente', 'Segmento', 'Produto', 'Linha', 'Fabricante', 'Vendedor', 'Qtd', 'Valor', 'Margem %'];
    const rows = sales.map(sale => [
      format(new Date(sale.order_date), 'dd/MM/yyyy'),
      sale.order_number || '',
      sale.distributor_name,
      sale.customer_name,
      sale.customer_segment,
      sale.product_name,
      sale.product_line,
      sale.manufacturer,
      sale.seller_name,
      sale.quantity_sale.toString(),
      sale.sale_value.toString(),
      (sale.gross_margin_percent * 100).toFixed(2)
    ]);

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_detalhadas_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Detalhes de Vendas</CardTitle>
            <CardDescription>
              {totalCount} registros encontrados
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Distribuidora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(new Date(sale.order_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{sale.distributor_name}</TableCell>
                        <TableCell>
                          <div className="max-w-[150px] truncate" title={sale.customer_name}>
                            {sale.customer_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.customer_segment}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium max-w-[150px] truncate" title={sale.product_name}>
                              {sale.product_name}
                            </span>
                            <span className="text-xs text-muted-foreground">{sale.manufacturer}</span>
                          </div>
                        </TableCell>
                        <TableCell>{sale.product_line}</TableCell>
                        <TableCell>
                          <div className="max-w-[120px] truncate" title={sale.seller_name}>
                            {sale.seller_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(sale.quantity_sale)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(sale.sale_value)}</TableCell>
                        <TableCell className="text-right">
                          {getMarginBadge(sale.gross_margin_percent)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
