import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ECFiltersProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
}

export function ECFilters({ statusFilter, onStatusChange }: ECFiltersProps) {
  return (
    <Select value={statusFilter} onValueChange={onStatusChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="pending">Pendente</SelectItem>
        <SelectItem value="in_progress">Em Andamento</SelectItem>
        <SelectItem value="at_risk">Em Risco</SelectItem>
        <SelectItem value="overdue">Atrasado</SelectItem>
        <SelectItem value="completed">Concluído</SelectItem>
        <SelectItem value="reviewed">Revisado</SelectItem>
      </SelectContent>
    </Select>
  );
}
