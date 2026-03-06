import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCockpitFilters } from '@/contexts/CockpitFiltersContext';
import { useCompany } from '@/contexts/CompanyContext';
import type { KPISummary } from '@/lib/cockpit-types';

function getDateRanges() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    today: today.toISOString().split('T')[0],
    monday: monday.toISOString().split('T')[0],
    monthStart: monthStart.toISOString().split('T')[0],
  };
}

async function fetchKPIsDirectly(companyId: string): Promise<KPISummary> {
  const dates = getDateRanges();

  const { data: salesData, error: salesError } = await supabase
    .from('sales_fact_daily')
    .select('net_value, order_count, client_id, sale_date')
    .eq('company_id', companyId)
    .gte('sale_date', dates.monthStart)
    .lte('sale_date', dates.today);

  if (salesError) throw new Error(salesError.message);

  const { data: baseData } = await supabase
    .from('customer_base_snapshot')
    .select('client_count')
    .eq('company_id', companyId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseClientCount = baseData?.client_count || 0;
  const sales = salesData || [];

  const salesDTD = sales
    .filter(s => s.sale_date === dates.today)
    .reduce((sum, s) => sum + Number(s.net_value || 0), 0);

  const salesWTD = sales
    .filter(s => s.sale_date >= dates.monday)
    .reduce((sum, s) => sum + Number(s.net_value || 0), 0);

  const salesMTD = sales.reduce((sum, s) => sum + Number(s.net_value || 0), 0);
  const ordersCount = sales.reduce((sum, s) => sum + Number(s.order_count || 0), 0);

  const uniqueClients = new Set(sales.map(s => s.client_id));
  const positivationCount = uniqueClients.size;
  const positivationPercent = baseClientCount > 0 ? (positivationCount / baseClientCount) * 100 : 0;
  const ticketAvg = ordersCount > 0 ? salesMTD / ordersCount : 0;

  return {
    salesDTD,
    salesWTD,
    salesMTD,
    salesVariation: 0,
    positivationCount,
    positivationTotal: baseClientCount,
    positivationPercent,
    positivationVariation: 0,
    coverageCount: positivationCount,
    coverageTotal: baseClientCount,
    coveragePercent: positivationPercent,
    coverageIsProxy: true,
    ordersCount,
    ordersVariation: 0,
    ticketAvg,
    ticketVariation: 0,
  };
}

export function useKPISummary() {
  const { filters } = useCockpitFilters();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: ['kpi-summary', companyId, filters.period, filters.channelCode],
    queryFn: () => fetchKPIsDirectly(companyId!),
    staleTime: 1000 * 60 * 5,
    enabled: !!companyId,
    retry: 1,
  });
}
