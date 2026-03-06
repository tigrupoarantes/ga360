import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCockpitFilters } from '@/contexts/CockpitFiltersContext';
import { useCompany } from '@/contexts/CompanyContext';
import type { CityHeatmapPoint } from '@/lib/cockpit-types';

export interface GeoHeatmapResponse {
  points: CityHeatmapPoint[];
  summary: {
    avgPositivation: number;
    totalCities: number;
    totalSales: number;
  };
}

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
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(today.getDate() - mondayOffset);
      break;
    }
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'custom':
      startDate = customStart || new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = customEnd || today;
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

async function fetchGeoHeatmapDirectly(
  companyId: string,
  period: string,
  customStartDate?: Date,
  customEndDate?: Date,
  channelCode?: string,
  uf?: string
): Promise<GeoHeatmapResponse> {
  const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);

  let salesQuery = supabase
    .from('sales_fact_daily')
    .select('city_id, client_id, net_value, order_count')
    .eq('company_id', companyId)
    .gte('sale_date', startDate)
    .lte('sale_date', endDate);

  if (channelCode && channelCode !== 'ALL') {
    salesQuery = salesQuery.eq('channel_code', channelCode);
  }

  const { data: salesData, error: salesError } = await salesQuery;
  if (salesError) throw new Error(salesError.message);

  let citiesQuery = supabase.from('city_dim').select('id, name, uf, lat, lng');
  if (uf) citiesQuery = citiesQuery.eq('uf', uf);

  const { data: citiesData, error: citiesError } = await citiesQuery;
  if (citiesError) throw new Error(citiesError.message);

  const { data: baseSnapshot } = await supabase
    .from('customer_base_snapshot')
    .select('client_count, snapshot_date')
    .eq('company_id', companyId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const cityMap = new Map((citiesData || []).map(c => [c.id, c]));
  const salesByCity = new Map<string, { sales: number; clients: Set<string> }>();

  (salesData || []).forEach(sale => {
    if (!sale.city_id) return;
    const city = cityMap.get(sale.city_id);
    if (!city) return;
    if (uf && city.uf !== uf) return;

    const existing = salesByCity.get(sale.city_id) || { sales: 0, clients: new Set<string>() };
    existing.sales += Number(sale.net_value || 0);
    if (sale.client_id) existing.clients.add(sale.client_id);
    salesByCity.set(sale.city_id, existing);
  });

  const totalBase = baseSnapshot?.client_count || 0;
  const avgBasePerCity = salesByCity.size > 0 ? Math.ceil(totalBase / salesByCity.size) : 0;

  const points: CityHeatmapPoint[] = [];
  let totalSales = 0;
  let totalPositivation = 0;

  salesByCity.forEach((data, cityId) => {
    const city = cityMap.get(cityId);
    if (!city || !city.lat || !city.lng) return;

    const positivatedClients = data.clients.size;
    const baseClients = avgBasePerCity;
    const positivationPercent = baseClients > 0 ? (positivatedClients / baseClients) * 100 : 0;

    points.push({
      cityId,
      cityName: city.name,
      uf: city.uf,
      lat: city.lat,
      lng: city.lng,
      positivationPercent: Math.min(positivationPercent, 100),
      coveragePercent: Math.min(positivationPercent, 100),
      salesTotal: data.sales,
      baseClients,
      positivatedClients,
    });

    totalSales += data.sales;
    totalPositivation += positivationPercent;
  });

  const avgPositivation = points.length > 0 ? totalPositivation / points.length : 0;
  return { points, summary: { avgPositivation, totalCities: points.length, totalSales } };
}

export function useGeoHeatmap(metric: 'positivacao' | 'cobertura' | 'vendas' = 'positivacao') {
  const { filters } = useCockpitFilters();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery<GeoHeatmapResponse | null, Error>({
    queryKey: ['geo-heatmap', companyId, filters.period, filters.channelCode, filters.uf, metric],
    queryFn: () =>
      fetchGeoHeatmapDirectly(
        companyId!,
        filters.period,
        filters.customStartDate,
        filters.customEndDate,
        filters.channelCode,
        filters.uf
      ),
    staleTime: 1000 * 60 * 5,
    enabled: !!companyId,
    retry: 1,
  });
}
