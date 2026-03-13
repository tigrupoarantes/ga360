import { format, subDays, startOfMonth } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCockpitVinculo } from '@/hooks/useCockpitVinculo';

export type PeriodoPreset = 'hoje' | 'ontem' | 'semana' | 'mes' | 'custom';

export interface FiltrosCockpitVendasState {
  periodo: PeriodoPreset;
  dataInicio: string;
  dataFim: string;
  codVendedorFiltro: string;
}

interface Props {
  filtros: FiltrosCockpitVendasState;
  onChange: (filtros: FiltrosCockpitVendasState) => void;
  /** Passa lista de vendedores disponíveis para dropdown (gestor) */
  vendedores?: { cod: string; nome: string }[];
}

export function getDateRange(periodo: PeriodoPreset, customInicio?: string, customFim?: string) {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  switch (periodo) {
    case 'hoje':
      return { dataInicio: hoje, dataFim: hoje };
    case 'ontem': {
      const ontem = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      return { dataInicio: ontem, dataFim: ontem };
    }
    case 'semana': {
      const seteDias = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      return { dataInicio: seteDias, dataFim: hoje };
    }
    case 'mes': {
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      return { dataInicio: inicioMes, dataFim: hoje };
    }
    case 'custom':
      return { dataInicio: customInicio ?? hoje, dataFim: customFim ?? hoje };
  }
}

export function FiltrosCockpitVendas({ filtros, onChange, vendedores = [] }: Props) {
  const { vinculo } = useCockpitVinculo();
  const isGestor = vinculo && ['supervisor', 'gerente', 'diretoria'].includes(vinculo.nivel_acesso);

  function handlePeriodo(periodo: PeriodoPreset) {
    const { dataInicio, dataFim } = getDateRange(periodo, filtros.dataInicio, filtros.dataFim);
    onChange({ ...filtros, periodo, dataInicio, dataFim });
  }

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {/* Período */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <Select value={filtros.periodo} onValueChange={(v) => handlePeriodo(v as PeriodoPreset)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="ontem">Ontem</SelectItem>
            <SelectItem value="semana">Últimos 7 dias</SelectItem>
            <SelectItem value="mes">Mês atual</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Datas customizadas */}
      {filtros.periodo === 'custom' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              className="w-36"
              value={filtros.dataInicio}
              onChange={(e) => onChange({ ...filtros, dataInicio: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              className="w-36"
              value={filtros.dataFim}
              onChange={(e) => onChange({ ...filtros, dataFim: e.target.value })}
            />
          </div>
        </>
      )}

      {/* Filtro por vendedor (apenas para gestores) */}
      {isGestor && vendedores.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Vendedor</Label>
          <Select
            value={filtros.codVendedorFiltro || 'todos'}
            onValueChange={(v) => onChange({ ...filtros, codVendedorFiltro: v === 'todos' ? '' : v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.cod} value={v.cod}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
