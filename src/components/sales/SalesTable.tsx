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

interface SalesTableProps {
  dateRange: { from: Date; to: Date };
  selectedDistributor: string;
}

interface SaleRecord {
  id: string;
  sale_date: string;
  product_code: string | null;
  product_name: string | null;
  product_category: string | null;
  quantity: number;
  total_value: number;
  customers_served: number;
  distributor_name: string;
}

const PAGE_SIZE = 20;

export function SalesTable({ dateRange, selectedDistributor }: SalesTableProps) {
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
  }, [selectedCompanyId, dateRange, selectedDistributor, search]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchSales();
    }
  }, [page]);

  const fetchSales = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('sales_daily')
        .select(`
          id,
          sale_date,
          product_code,
          product_name,
          product_category,
          quantity,
          total_value,
          customers_served,
          distributors!inner(name)
        `, { count: 'exact' })
        .eq('company_id', selectedCompanyId)
        .gte('sale_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('sale_date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('sale_date', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedDistributor !== "all") {
        query = query.eq('distributor_id', selectedDistributor);
      }

      if (search) {
        query = query.or(`product_name.ilike.%${search}%,product_code.ilike.%${search}%,product_category.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const salesData: SaleRecord[] = (data || []).map(sale => ({
        id: sale.id,
        sale_date: sale.sale_date,
        product_code: sale.product_code,
        product_name: sale.product_name,
        product_category: sale.product_category,
        quantity: Number(sale.quantity),
        total_value: Number(sale.total_value),
        customers_served: sale.customers_served,
        distributor_name: (sale.distributors as any)?.name || ''
      }));

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

  const exportCSV = () => {
    const headers = ['Data', 'Distribuidora', 'Código', 'Produto', 'Categoria', 'Quantidade', 'Valor', 'Clientes'];
    const rows = sales.map(sale => [
      format(new Date(sale.sale_date), 'dd/MM/yyyy'),
      sale.distributor_name,
      sale.product_code || '',
      sale.product_name || '',
      sale.product_category || '',
      sale.quantity.toString(),
      sale.total_value.toString(),
      sale.customers_served.toString()
    ]);

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${format(new Date(), 'yyyyMMdd')}.csv`;
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
                placeholder="Buscar produto..."
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Distribuidora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">
                          {format(new Date(sale.sale_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{sale.distributor_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{sale.product_name || '-'}</span>
                            {sale.product_code && (
                              <span className="text-xs text-muted-foreground">{sale.product_code}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{sale.product_category || '-'}</TableCell>
                        <TableCell className="text-right">{formatNumber(sale.quantity)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sale.total_value)}</TableCell>
                        <TableCell className="text-right">{formatNumber(sale.customers_served)}</TableCell>
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
