import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Building2, Layers, Filter, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date;
  to: Date;
}

interface AnalyticsFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedCompanyId: string | null;
  onCompanyChange: (companyId: string | null) => void;
  selectedAreaId: string | null;
  onAreaChange: (areaId: string | null) => void;
}

interface Company {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
  company_id: string;
}

const presetRanges = [
  { label: "7 dias", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "30 dias", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "90 dias", getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: "6 meses", getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: "Ano atual", getValue: () => ({ from: startOfYear(new Date()), to: new Date() }) },
  { label: "12 meses", getValue: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
];

export function AnalyticsFilters({
  dateRange,
  onDateRangeChange,
  selectedCompanyId,
  onCompanyChange,
  selectedAreaId,
  onAreaChange,
}: AnalyticsFiltersProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filteredAreas, setFilteredAreas] = useState<Area[]>([]);

  useEffect(() => {
    fetchCompanies();
    fetchAreas();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      setFilteredAreas(areas.filter((a) => a.company_id === selectedCompanyId));
      if (selectedAreaId) {
        const areaExists = areas.find((a) => a.id === selectedAreaId && a.company_id === selectedCompanyId);
        if (!areaExists) {
          onAreaChange(null);
        }
      }
    } else {
      setFilteredAreas(areas);
    }
  }, [selectedCompanyId, areas]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (data) setCompanies(data);
  };

  const fetchAreas = async () => {
    const { data } = await supabase
      .from("areas")
      .select("id, name, company_id")
      .order("name");
    if (data) setAreas(data);
  };

  const handleReset = () => {
    onCompanyChange(null);
    onAreaChange(null);
    onDateRangeChange({ from: subDays(new Date(), 90), to: new Date() });
  };

  return (
    <Card className="p-4 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Date Range Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal min-w-[240px]",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                      {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  )
                ) : (
                  <span>Selecionar período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b">
                <div className="flex flex-wrap gap-2">
                  {presetRanges.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      onClick={() => onDateRangeChange(preset.getValue())}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    onDateRangeChange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {/* Company Selector */}
          <Select
            value={selectedCompanyId || "all"}
            onValueChange={(value) => onCompanyChange(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Todas as Empresas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Empresas</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Area Selector */}
          <Select
            value={selectedAreaId || "all"}
            onValueChange={(value) => onAreaChange(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Todas as Áreas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Áreas</SelectItem>
              {filteredAreas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Button */}
          <Button variant="ghost" size="icon" onClick={handleReset} title="Limpar filtros">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
