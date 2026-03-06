/**
 * useLogisticsData — hooks para a aba Logística
 *
 * Consome `venda_prod` via dab-proxy e calcula:
 *  - Curva ABC por faturamento
 *  - Mix Campeão por UF/Cidade
 *  - KPIs de visão geral
 *  - Posição de Estoque (stock_position)
 *  - Lotes e Validade (stock_lots)
 *
 * Adaptações GA360:
 *  - selectedCompany.external_id → código DAB numérico para filtros OData
 *  - dabFetch importado de @/lib/dab
 */

import { useQuery } from '@tanstack/react-query';
import { dabFetch } from '@/lib/dab';
import { useCockpitFilters } from '@/contexts/CockpitFiltersContext';
import { useCompany } from '@/contexts/CompanyContext';
import type {
  DabVendaProd,
  DabVendaProdRaw,
  DabStockPositionRaw,
  DabStockPosition,
  DabStockLot,
  ABCItem,
  MixItem,
} from '@/lib/cockpit-types';

// ─── Helpers ─────────────────────────────────────────────────

function getDateRange(period: string, customStart?: Date, customEnd?: Date) {
  const today = new Date();
  let startDate: Date;
  let endDate: Date = today;

  switch (period) {
    case 'today':
      startDate = today;
      break;
    case 'week': {
      startDate = new Date(today);
      const dow = today.getDay();
      startDate.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      break;
    }
    case 'custom':
      startDate = customStart || new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = customEnd || today;
      break;
    case 'month':
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    dt_ini: startDate.toISOString().split('T')[0],
    dt_fim: endDate.toISOString().split('T')[0],
  };
}

function aggregateBySku(rows: DabVendaProd[]) {
  const map = new Map<string, { name: string; revenue: number; quantity: number; cities: Set<string> }>();

  for (const r of rows) {
    const key = r.cod_produto;
    const existing = map.get(key);
    if (existing) {
      existing.revenue += Number(r.vlr_liquido || 0);
      existing.quantity += Number(r.qtd_vendida || 0);
      if (r.desc_cidade) existing.cities.add(r.desc_cidade);
    } else {
      map.set(key, {
        name: r.desc_produto || key,
        revenue: Number(r.vlr_liquido || 0),
        quantity: Number(r.qtd_vendida || 0),
        cities: new Set(r.desc_cidade ? [r.desc_cidade] : []),
      });
    }
  }

  return map;
}

function computeABC(aggregated: Map<string, { name: string; revenue: number; quantity: number }>): ABCItem[] {
  const items = Array.from(aggregated.entries())
    .map(([sku, data]) => ({ sku, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
  if (totalRevenue === 0) return [];

  let cumulative = 0;
  return items.map((item) => {
    const pct = (item.revenue / totalRevenue) * 100;
    cumulative += pct;

    let classification: 'A' | 'B' | 'C';
    if (cumulative <= 80) classification = 'A';
    else if (cumulative <= 95) classification = 'B';
    else classification = 'C';

    return {
      sku: item.sku,
      name: item.name,
      revenue: item.revenue,
      quantity: item.quantity,
      percentOfTotal: pct,
      cumulativePercent: cumulative,
      classification,
    };
  });
}

// ─── Fetch comum ─────────────────────────────────────────────

async function fetchVendaProd(
  companyExternalId: string,
  dtIni: string,
  dtFim: string,
  uf?: string
): Promise<DabVendaProd[]> {
  const filters: string[] = [];

  if (dtIni) filters.push(`DATA_VENDA ge '${dtIni}'`);
  if (dtFim) filters.push(`DATA_VENDA le '${dtFim}T23:59:59'`);
  // COD_EMPRESA é numérico no DAB — usar external_id diretamente
  if (companyExternalId) filters.push(`COD_EMPRESA eq ${companyExternalId}`);
  if (uf) filters.push(`UF_CLIENTE eq '${uf}'`);

  const query: Record<string, string | number> = {
    '$first': 5000,
    '$filter': filters.join(' and '),
  };

  const mapToInternal = (raw: DabVendaProdRaw): DabVendaProd => ({
    cod_empresa: String(raw.COD_EMPRESA),
    cod_produto: String(raw.SKU_PRODUTO),
    desc_produto: raw.DESCRICAO_PRODUTO,
    cod_cidade: undefined,
    desc_cidade: raw.CIDADE_CLIENTE,
    uf: raw.UF_CLIENTE,
    cod_canal: undefined,
    qtd_vendida: raw.QTDE_VENDIDA,
    vlr_liquido: (raw.VL_UNIT_VENDA || 0) * (raw.QTDE_VENDIDA || 0),
    dt_venda: raw.DATA_VENDA,
  });

  let allData: DabVendaProd[] = [];
  const first = await dabFetch<DabVendaProdRaw>({ path: 'venda_prod', query });
  if (first.value) allData = first.value.map(mapToInternal);

  let nextLink = first.nextLink;
  let page = 1;
  while (nextLink && page < 10) {
    const next = await dabFetch<DabVendaProdRaw>({ path: 'venda_prod', absoluteNextLink: nextLink });
    if (next.value) allData = allData.concat(next.value.map(mapToInternal));
    nextLink = next.nextLink;
    page++;
  }

  return allData;
}

// ─── Hooks públicos ──────────────────────────────────────────

export function useVendaProd() {
  const { selectedCompany } = useCompany();
  const { filters } = useCockpitFilters();
  // external_id é o código DAB numérico (ex: '2', '3')
  const companyExternalId = selectedCompany?.external_id;
  const { dt_ini, dt_fim } = getDateRange(filters.period, filters.customStartDate, filters.customEndDate);

  return useQuery<DabVendaProd[], Error>({
    queryKey: ['venda-prod', companyExternalId, dt_ini, dt_fim, filters.channelCode, filters.uf],
    queryFn: () => fetchVendaProd(companyExternalId!, dt_ini, dt_fim, filters.uf),
    enabled: !!companyExternalId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

export function useABCData() {
  const { data: vendas, isLoading, error, isError } = useVendaProd();

  const abcData = vendas ? computeABC(aggregateBySku(vendas)) : [];

  const summary = {
    totalSkus: abcData.length,
    classA: abcData.filter((i) => i.classification === 'A').length,
    classB: abcData.filter((i) => i.classification === 'B').length,
    classC: abcData.filter((i) => i.classification === 'C').length,
    totalRevenue: abcData.reduce((sum, i) => sum + i.revenue, 0),
  };

  return { abcData, summary, isLoading, error, isError };
}

export function useMixCampeao(regionFilter?: string, topN: number = 10) {
  const { data: vendas, isLoading, error, isError } = useVendaProd();

  let filtered = vendas || [];
  if (regionFilter) {
    filtered = filtered.filter((v) => v.uf === regionFilter || v.desc_cidade === regionFilter);
  }

  const aggregated = aggregateBySku(filtered);

  const mixItems: MixItem[] = Array.from(aggregated.entries())
    .map(([sku, data]) => ({
      sku,
      name: data.name,
      revenue: data.revenue,
      quantity: data.quantity,
      citiesCount: data.cities.size,
      region: regionFilter || 'Todos',
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, topN);

  return { mixItems, isLoading, error, isError };
}

export function useLogisticsOverview() {
  const { data: vendas, isLoading, error, isError } = useVendaProd();

  const rows = vendas || [];
  const totalRevenue = rows.reduce((s, r) => s + Number(r.vlr_liquido || 0), 0);
  const totalQuantity = rows.reduce((s, r) => s + Number(r.qtd_vendida || 0), 0);
  const uniqueSkus = new Set(rows.map((r) => r.cod_produto)).size;
  const avgRevenuePerSku = uniqueSkus > 0 ? totalRevenue / uniqueSkus : 0;

  const aggregated = aggregateBySku(rows);
  let topSku = { sku: '—', name: '—', revenue: 0 };
  for (const [sku, data] of aggregated.entries()) {
    if (data.revenue > topSku.revenue) topSku = { sku, name: data.name, revenue: data.revenue };
  }

  return { overview: { totalRevenue, totalQuantity, uniqueSkus, avgRevenuePerSku, topSku }, isLoading, error, isError };
}

export function useStockPosition() {
  const { selectedCompany } = useCompany();
  const { filters } = useCockpitFilters();
  const companyExternalId = selectedCompany?.external_id;

  return useQuery<DabStockPosition[], Error>({
    queryKey: ['stock-position', companyExternalId],
    queryFn: async () => {
      if (!companyExternalId) return [];

      const mapToInternal = (raw: DabStockPositionRaw): DabStockPosition => ({
        cod_empresa: String(raw.tenant_id),
        cod_produto: String(raw.id_sku),
        desc_produto: raw.nm_sku,
        cod_local: 'UNK',
        desc_local: 'Padrão',
        qtd_estoque: raw.qt_estoque,
        vlr_estoque: 0,
      });

      const res = await dabFetch<DabStockPositionRaw>({
        path: 'stock_position',
        query: { '$filter': `tenant_id eq ${companyExternalId}`, '$first': 1000 },
      });
      return (res.value || []).map(mapToInternal);
    },
    enabled: !!companyExternalId,
    staleTime: 1000 * 60 * 15,
  });
}

export function useStockLots() {
  const { selectedCompany } = useCompany();
  const { filters } = useCockpitFilters();
  const companyExternalId = selectedCompany?.external_id;

  return useQuery<DabStockLot[], Error>({
    queryKey: ['stock-lots', companyExternalId],
    queryFn: async () => {
      if (!companyExternalId) return [];
      const res = await dabFetch<DabStockLot>({
        path: 'stock_lots',
        query: {
          '$filter': `cod_empresa eq '${companyExternalId}' and qtd_estoque gt 0`,
          '$orderby': 'dt_validade asc',
          '$first': 1000,
        },
      });
      return res.value || [];
    },
    enabled: !!companyExternalId,
    staleTime: 1000 * 60 * 15,
  });
}
