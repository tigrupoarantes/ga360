import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { VIQueryFilters } from '@/hooks/useVerbasIndenizatorias';
import { useVICnpjGroups } from '@/hooks/useVerbasIndenizatorias';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent_to_sign', label: 'Aguardando assinatura' },
  { value: 'waiting_signature', label: 'Em assinatura' },
  { value: 'signed', label: 'Assinado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'error', label: 'Erro' },
];

interface Props {
  filters: VIQueryFilters;
  onChange: (filters: VIQueryFilters) => void;
  companyId: string | null;
}

export function VIFilters({ filters, onChange, companyId }: Props) {
  const { data: cnpjGroups = [] } = useVICnpjGroups(companyId, filters.competencia ?? '');

  function handleReset() {
    onChange({ page: 1 });
  }

  const hasFilters = !!(filters.competencia || filters.cpf || filters.status || filters.cnpj);

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[160px] max-w-[220px]">
        <Input
          placeholder="Competência (2026-03)"
          value={filters.competencia ?? ''}
          onChange={(e) => onChange({ ...filters, competencia: e.target.value || undefined, cnpj: undefined, page: 1 })}
          className="text-sm"
        />
      </div>

      <div className="relative flex-1 min-w-[160px] max-w-[240px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="CPF ou nome..."
          value={filters.cpf ?? ''}
          onChange={(e) => onChange({ ...filters, cpf: e.target.value || undefined, page: 1 })}
          className="pl-8 text-sm"
        />
      </div>

      <Select
        value={filters.status ?? 'all'}
        onValueChange={(v) => onChange({ ...filters, status: v === 'all' ? undefined : v, page: 1 })}
      >
        <SelectTrigger className="w-[200px] text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.cnpj ?? 'all'}
        onValueChange={(v) => onChange({ ...filters, cnpj: v === 'all' ? undefined : v, page: 1 })}
        disabled={!filters.competencia || cnpjGroups.length === 0}
      >
        <SelectTrigger className="w-[260px] text-sm">
          <SelectValue placeholder="Empresa (CNPJ)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as empresas</SelectItem>
          {cnpjGroups.map((g) => (
            <SelectItem key={g.cnpj} value={g.cnpj}>
              {g.companyName} ({g.cnpj})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
