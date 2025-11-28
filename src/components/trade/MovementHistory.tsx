import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDownToLine, ArrowUpFromLine, CalendarIcon, Filter, History, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

interface MovementHistoryProps {
  selectedIndustryId: string | null;
}

export function MovementHistory({ selectedIndustryId }: MovementHistoryProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("");
  const { selectedCompanyId } = useCompany();

  const { data: industries } = useQuery({
    queryKey: ["trade-industries-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_industries")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: movements, isLoading } = useQuery({
    queryKey: ["trade-movements-history", selectedIndustryId, selectedCompanyId, startDate, endDate, typeFilter, clientFilter],
    queryFn: async () => {
      let query = supabase
        .from("trade_inventory_movements")
        .select(`
          *,
          trade_materials!inner (
            id,
            name,
            category,
            industry_id,
            trade_industries (
              id,
              name
            )
          )
        `)
        .order("movement_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (selectedIndustryId) {
        query = query.eq("trade_materials.industry_id", selectedIndustryId);
      }

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      if (startDate) {
        query = query.gte("movement_date", format(startDate, "yyyy-MM-dd"));
      }

      if (endDate) {
        query = query.lte("movement_date", format(endDate, "yyyy-MM-dd"));
      }

      if (typeFilter !== "all") {
        query = query.eq("movement_type", typeFilter);
      }

      if (clientFilter.trim()) {
        query = query.ilike("client_name", `%${clientFilter.trim()}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTypeFilter("all");
    setClientFilter("");
  };

  const hasFilters = startDate || endDate || typeFilter !== "all" || clientFilter;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de Movimentações
        </h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-xs">Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Data Final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Movement Type */}
          <div className="space-y-2">
            <Label className="text-xs">Tipo</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de movimentação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client Filter */}
          <div className="space-y-2">
            <Label className="text-xs">Cliente</Label>
            <Input
              placeholder="Buscar por cliente..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Movement List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Indústria</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma movimentação encontrada</p>
                </TableCell>
              </TableRow>
            ) : (
              movements?.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>
                    <span className="text-sm">
                      {format(new Date(mov.movement_date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {mov.movement_type === "entrada" ? (
                      <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                        <ArrowDownToLine className="h-3 w-3 mr-1" />
                        Entrada
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                        <ArrowUpFromLine className="h-3 w-3 mr-1" />
                        Saída
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{mov.trade_materials?.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {mov.trade_materials?.trade_industries?.name || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-medium",
                      mov.movement_type === "entrada" ? "text-green-600" : "text-orange-600"
                    )}>
                      {mov.movement_type === "entrada" ? "+" : "-"}{mov.quantity}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{mov.client_name || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{mov.reference_number || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                      {mov.notes || "-"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
