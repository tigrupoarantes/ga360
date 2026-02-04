import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Filter } from "lucide-react";
import { format, subDays, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/external-client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DateRange {
  from: Date;
  to: Date;
}

interface Distributor {
  id: string;
  name: string;
  code: string | null;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedDistributor: string;
  onDistributorChange: (distributorId: string) => void;
  // Novos filtros
  selectedSegment: string;
  onSegmentChange: (segment: string) => void;
  selectedNetwork: string;
  onNetworkChange: (network: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
  selectedManufacturer: string;
  onManufacturerChange: (manufacturer: string) => void;
  selectedSupervisor: string;
  onSupervisorChange: (supervisor: string) => void;
}

export function SalesFilters({
  dateRange,
  onDateRangeChange,
  selectedDistributor,
  onDistributorChange,
  selectedSegment,
  onSegmentChange,
  selectedNetwork,
  onNetworkChange,
  selectedLine,
  onLineChange,
  selectedManufacturer,
  onManufacturerChange,
  selectedSupervisor,
  onSupervisorChange
}: SalesFiltersProps) {
  const { selectedCompanyId } = useCompany();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [segments, setSegments] = useState<FilterOption[]>([]);
  const [networks, setNetworks] = useState<FilterOption[]>([]);
  const [lines, setLines] = useState<FilterOption[]>([]);
  const [manufacturers, setManufacturers] = useState<FilterOption[]>([]);
  const [supervisors, setSupervisors] = useState<FilterOption[]>([]);
  const [quickRange, setQuickRange] = useState("month");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchDistributors();
      fetchFilterOptions();
    }
  }, [selectedCompanyId]);

  const fetchDistributors = async () => {
    if (!selectedCompanyId) return;

    const { data, error } = await supabase
      .from('distributors')
      .select('id, name, code')
      .eq('company_id', selectedCompanyId)
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setDistributors(data);
    }
  };

  const fetchFilterOptions = async () => {
    if (!selectedCompanyId) return;

    // Fetch segments (using any to bypass type checking for new table)
    const { data: segmentData } = await (supabase as any)
      .from('sales_customers')
      .select('segment')
      .eq('company_id', selectedCompanyId)
      .not('segment', 'is', null);

    if (segmentData) {
      const uniqueSegments = [...new Set(segmentData.map((s: any) => s.segment).filter(Boolean))];
      setSegments(uniqueSegments.map((s: string) => ({ value: s, label: s })));
    }

    // Fetch networks
    const { data: networkData } = await (supabase as any)
      .from('sales_customers')
      .select('network')
      .eq('company_id', selectedCompanyId)
      .not('network', 'is', null);

    if (networkData) {
      const uniqueNetworks = [...new Set(networkData.map((n: any) => n.network).filter(Boolean))];
      setNetworks(uniqueNetworks.map((n: string) => ({ value: n, label: n })));
    }

    // Fetch lines
    const { data: lineData } = await (supabase as any)
      .from('sales_products')
      .select('line')
      .eq('company_id', selectedCompanyId)
      .not('line', 'is', null);

    if (lineData) {
      const uniqueLines = [...new Set(lineData.map((l: any) => l.line).filter(Boolean))];
      setLines(uniqueLines.map((l: string) => ({ value: l, label: l })));
    }

    // Fetch manufacturers
    const { data: manufacturerData } = await (supabase as any)
      .from('sales_products')
      .select('manufacturer')
      .eq('company_id', selectedCompanyId)
      .not('manufacturer', 'is', null);

    if (manufacturerData) {
      const uniqueManufacturers = [...new Set(manufacturerData.map((m: any) => m.manufacturer).filter(Boolean))];
      setManufacturers(uniqueManufacturers.map((m: string) => ({ value: m, label: m })));
    }

    // Fetch supervisors
    const { data: supervisorData } = await (supabase as any)
      .from('sales_team')
      .select('supervisor_code, supervisor_name')
      .eq('company_id', selectedCompanyId)
      .not('supervisor_code', 'is', null);

    if (supervisorData) {
      const supervisorMap = new Map<string, string>();
      supervisorData.forEach((s: any) => {
        if (s.supervisor_code && !supervisorMap.has(s.supervisor_code)) {
          supervisorMap.set(s.supervisor_code, s.supervisor_name || s.supervisor_code);
        }
      });
      setSupervisors(Array.from(supervisorMap.entries()).map(([code, name]) => ({ 
        value: code, 
        label: name 
      })));
    }
  };

  const handleQuickRangeChange = (value: string) => {
    setQuickRange(value);
    const today = new Date();
    
    switch (value) {
      case "today":
        onDateRangeChange({ from: today, to: today });
        break;
      case "week":
        onDateRangeChange({ from: startOfWeek(today, { locale: ptBR }), to: today });
        break;
      case "month":
        onDateRangeChange({ from: startOfMonth(today), to: today });
        break;
      case "30days":
        onDateRangeChange({ from: subDays(today, 30), to: today });
        break;
      case "60days":
        onDateRangeChange({ from: subDays(today, 60), to: today });
        break;
      case "90days":
        onDateRangeChange({ from: subDays(today, 90), to: today });
        break;
      case "custom":
        break;
    }
  };

  const hasAdvancedFilters = selectedSegment !== "all" || 
    selectedNetwork !== "all" || 
    selectedLine !== "all" || 
    selectedManufacturer !== "all" || 
    selectedSupervisor !== "all";

  const clearAdvancedFilters = () => {
    onSegmentChange("all");
    onNetworkChange("all");
    onLineChange("all");
    onManufacturerChange("all");
    onSupervisorChange("all");
  };

  return (
    <div className="space-y-3">
      {/* Primary Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Quick Range Select */}
        <Select value={quickRange} onValueChange={handleQuickRangeChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="30days">Últimos 30 dias</SelectItem>
            <SelectItem value="60days">Últimos 60 dias</SelectItem>
            <SelectItem value="90days">Últimos 90 dias</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                <span>Selecione um período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onDateRangeChange({ from: range.from, to: range.to });
                  setQuickRange("custom");
                }
              }}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {/* Distributor Select */}
        <Select value={selectedDistributor} onValueChange={onDistributorChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas distribuidoras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas distribuidoras</SelectItem>
            {distributors.map((dist) => (
              <SelectItem key={dist.id} value={dist.id}>
                {dist.name} {dist.code && `(${dist.code})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Advanced Filters Toggle */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros Avançados
              {hasAdvancedFilters && (
                <span className="ml-1 rounded-full bg-primary w-2 h-2" />
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        {hasAdvancedFilters && (
          <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Advanced Filters Row */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-3 items-center pt-2 border-t">
            {/* Segment Select */}
            {segments.length > 0 && (
              <Select value={selectedSegment} onValueChange={onSegmentChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos segmentos</SelectItem>
                  {segments.map((seg) => (
                    <SelectItem key={seg.value} value={seg.value}>
                      {seg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Network Select */}
            {networks.length > 0 && (
              <Select value={selectedNetwork} onValueChange={onNetworkChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Rede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas redes</SelectItem>
                  {networks.map((net) => (
                    <SelectItem key={net.value} value={net.value}>
                      {net.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Line Select */}
            {lines.length > 0 && (
              <Select value={selectedLine} onValueChange={onLineChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Linha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas linhas</SelectItem>
                  {lines.map((line) => (
                    <SelectItem key={line.value} value={line.value}>
                      {line.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Manufacturer Select */}
            {manufacturers.length > 0 && (
              <Select value={selectedManufacturer} onValueChange={onManufacturerChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Fabricante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos fabricantes</SelectItem>
                  {manufacturers.map((mfr) => (
                    <SelectItem key={mfr.value} value={mfr.value}>
                      {mfr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Supervisor Select */}
            {supervisors.length > 0 && (
              <Select value={selectedSupervisor} onValueChange={onSupervisorChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos supervisores</SelectItem>
                  {supervisors.map((sup) => (
                    <SelectItem key={sup.value} value={sup.value}>
                      {sup.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
