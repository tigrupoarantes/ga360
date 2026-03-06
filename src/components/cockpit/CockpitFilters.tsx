/**
 * CockpitFilters — barra de filtros global do Cockpit
 *
 * Este componente fica no topo do <main> de cada página cockpit (não no AppleNav).
 *
 * Adaptações vs GlobalFilters do cockpit:
 * - Sem AppLayout/header — é um componente de conteúdo
 * - useAuth() (cockpit) → useCompany() + setSelectedCompanyId()
 * - useFilters() → useCockpitFilters()
 * - Selector de empresa usa UUID do GA360; segment options vêm de useDatalakeCompanies()
 */

import { useEffect, useState, useCallback } from 'react';
import { Building2, Calendar, Users, Layers, MapPin, Store } from 'lucide-react';
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
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import type { CockpitFilters as CockpitFiltersType } from '@/lib/cockpit-types';

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'custom', label: 'Personalizado' },
];

const CHANNELS = [
  { value: 'ALL', label: 'Todos os Canais' },
  { value: 'KA', label: 'Key Account' },
  { value: 'AS', label: 'Auto Serviço' },
  { value: 'TRAD', label: 'Tradicional' },
];

const UFS = [
  { value: 'all', label: 'Todos os Estados' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PR', label: 'Paraná' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'RS', label: 'Rio Grande do Sul' },
];

export function CockpitFilters() {
  const { companies, selectedCompany, setSelectedCompanyId } = useCompany();
  const { filters, updateFilters } = useCockpitFilters();
  const { data: datalakeCompanies = [] } = useDatalakeCompanies();

  const [segmentOptions, setSegmentOptions] = useState<{ code: string; name: string }[]>([]);

  // Find the Datalake representation of the selected company (for segment mode)
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
          ...(datalakeCompany.industries || []).map((ind) => ({ code: ind.code, name: ind.name })),
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

  const getSegmentIcon = () => (segmentMode === 'store' ? Store : Layers);
  const getSegmentLabel = () => {
    switch (segmentMode) {
      case 'industry': return 'Indústria';
      case 'bu': return 'BU';
      case 'store': return 'Loja';
      case 'category': return 'Categoria';
      default: return 'Segmento';
    }
  };

  const SegmentIcon = getSegmentIcon();

  return (
    <div className="bg-card border-b border-border px-4 py-2 flex flex-wrap items-center gap-3">
      {/* Company selector */}
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Select
          value={selectedCompany?.id || ''}
          onValueChange={(id) => setSelectedCompanyId(id)}
        >
          <SelectTrigger className="w-[200px] border-0 bg-muted/50 hover:bg-muted focus:ring-1">
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.filter((c) => c.is_active).map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.period}
          onValueChange={(value) => updateFilters({ period: value as CockpitFiltersType['period'] })}
        >
          <SelectTrigger className="w-[140px] border-0 bg-muted/50 hover:bg-muted focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Channel selector */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.channelCode}
          onValueChange={(value) => updateFilters({ channelCode: value as CockpitFiltersType['channelCode'] })}
        >
          <SelectTrigger className="w-[160px] border-0 bg-muted/50 hover:bg-muted focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((channel) => (
              <SelectItem key={channel.value} value={channel.value}>{channel.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Segment selector */}
      <div className="flex items-center gap-2">
        <SegmentIcon className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.segmentId || 'all'}
          onValueChange={(value) => updateFilters({ segmentId: value === 'all' ? undefined : value })}
        >
          <SelectTrigger className="w-[180px] border-0 bg-muted/50 hover:bg-muted focus:ring-1">
            <SelectValue placeholder={getSegmentLabel()} />
          </SelectTrigger>
          <SelectContent>
            {segmentOptions.map((segment) => (
              <SelectItem key={segment.code} value={segment.code}>{segment.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* UF selector */}
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.uf || 'all'}
          onValueChange={(value) => updateFilters({ uf: value === 'all' ? undefined : value })}
        >
          <SelectTrigger className="w-[160px] border-0 bg-muted/50 hover:bg-muted focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UFS.map((uf) => (
              <SelectItem key={uf.value} value={uf.value}>{uf.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      <ConnectionStatusBadge />
    </div>
  );
}
