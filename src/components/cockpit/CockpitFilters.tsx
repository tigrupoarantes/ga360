/**
 * CockpitFilters — filtros inline do Cockpit
 *
 * - Empresa: controlada pelo MainLayout (useCompany) — removida daqui
 * - ConnectionStatusBadge: removida — Status de conexão fica em /cockpit/config
 * - Este componente fornece apenas os filtros analíticos: período, canal, segmento, UF
 */

import { useEffect, useState, useCallback } from 'react';
import { Calendar, Users, Layers, MapPin, Store } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCompany } from '@/contexts/CompanyContext';
import { useCockpitFilters } from '@/contexts/CockpitFiltersContext';
import { useDatalakeCompanies } from '@/hooks/cockpit/useDatalakeCompanies';
import type { CockpitFilters as CockpitFiltersType } from '@/lib/cockpit-types';

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week',  label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'custom', label: 'Personalizado' },
];

const CHANNELS = [
  { value: 'ALL',  label: 'Todos os Canais' },
  { value: 'KA',   label: 'Key Account' },
  { value: 'AS',   label: 'Auto Serviço' },
  { value: 'TRAD', label: 'Tradicional' },
];

const UFS = [
  { value: 'all', label: 'Todos os Estados' },
  { value: 'SP',  label: 'São Paulo' },
  { value: 'RJ',  label: 'Rio de Janeiro' },
  { value: 'MG',  label: 'Minas Gerais' },
  { value: 'PR',  label: 'Paraná' },
  { value: 'SC',  label: 'Santa Catarina' },
  { value: 'RS',  label: 'Rio Grande do Sul' },
];

export function CockpitFilters() {
  const { selectedCompany } = useCompany();
  const { filters, updateFilters } = useCockpitFilters();
  const { data: datalakeCompanies = [] } = useDatalakeCompanies();

  const [segmentOptions, setSegmentOptions] = useState<{ code: string; name: string }[]>([]);

  const datalakeCompany = datalakeCompanies.find(
    (dc) => dc.code === selectedCompany?.external_id
  );
  const segmentMode = datalakeCompany?.segmentMode || 'bu';

  const buildSegmentOptions = useCallback(() => {
    if (!datalakeCompany) {
      setSegmentOptions([{ code: 'all', name: 'Todos' }]);
      return;
    }
    let options: { code: string; name: string }[] = [];
    switch (segmentMode) {
      case 'industry':
        options = [
          { code: 'all', name: 'Todas as Indústrias' },
          ...(datalakeCompany.industries || []).map((i) => ({ code: i.code, name: i.name })),
        ];
        break;
      case 'bu':
        options = [
          { code: 'all', name: 'Todas as BUs' },
          ...(datalakeCompany.businessUnits || []).map((bu) => ({ code: bu.code, name: bu.name })),
        ];
        break;
      case 'store':
        options = [
          { code: 'all', name: 'Todas as Lojas' },
          ...(datalakeCompany.stores || []).map((s) => ({ code: s.code, name: `${s.code} - ${s.name}` })),
        ];
        break;
      default:
        options = [{ code: 'all', name: 'Todos' }];
    }
    setSegmentOptions(options);
  }, [datalakeCompany, segmentMode]);

  useEffect(() => {
    buildSegmentOptions();
    if (selectedCompany) {
      updateFilters({ segmentType: segmentMode === 'industry' ? 'industry' : 'bu' });
    }
  }, [selectedCompany, datalakeCompany, segmentMode, buildSegmentOptions, updateFilters]);

  const SegmentIcon = segmentMode === 'store' ? Store : Layers;
  const segmentLabel =
    segmentMode === 'industry' ? 'Indústria'
    : segmentMode === 'store'   ? 'Loja'
    : segmentMode === 'category'? 'Categoria'
    : 'BU';

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {/* Período */}
      <div className="flex items-center gap-1.5 bg-muted/60 hover:bg-muted rounded-lg px-2 py-1 transition-colors">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select
          value={filters.period}
          onValueChange={(v) => updateFilters({ period: v as CockpitFiltersType['period'] })}
        >
          <SelectTrigger className="h-7 border-0 bg-transparent p-0 pr-6 text-sm focus:ring-0 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Canal */}
      <div className="flex items-center gap-1.5 bg-muted/60 hover:bg-muted rounded-lg px-2 py-1 transition-colors">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select
          value={filters.channelCode}
          onValueChange={(v) => updateFilters({ channelCode: v as CockpitFiltersType['channelCode'] })}
        >
          <SelectTrigger className="h-7 border-0 bg-transparent p-0 pr-6 text-sm focus:ring-0 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Segmento */}
      <div className="flex items-center gap-1.5 bg-muted/60 hover:bg-muted rounded-lg px-2 py-1 transition-colors">
        <SegmentIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select
          value={filters.segmentId || 'all'}
          onValueChange={(v) => updateFilters({ segmentId: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="h-7 border-0 bg-transparent p-0 pr-6 text-sm focus:ring-0 w-[150px]">
            <SelectValue placeholder={segmentLabel} />
          </SelectTrigger>
          <SelectContent>
            {segmentOptions.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* UF */}
      <div className="flex items-center gap-1.5 bg-muted/60 hover:bg-muted rounded-lg px-2 py-1 transition-colors">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select
          value={filters.uf || 'all'}
          onValueChange={(v) => updateFilters({ uf: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="h-7 border-0 bg-transparent p-0 pr-6 text-sm focus:ring-0 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UFS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
