import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";

interface DateRange {
  from: Date;
  to: Date;
}

interface Distributor {
  id: string;
  name: string;
  code: string | null;
}

interface SalesFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedDistributor: string;
  onDistributorChange: (distributorId: string) => void;
}

export function SalesFilters({
  dateRange,
  onDateRangeChange,
  selectedDistributor,
  onDistributorChange
}: SalesFiltersProps) {
  const { selectedCompanyId } = useCompany();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [quickRange, setQuickRange] = useState("month");

  useEffect(() => {
    if (selectedCompanyId) {
      fetchDistributors();
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
        // Keep current range
        break;
    }
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
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
    </div>
  );
}
