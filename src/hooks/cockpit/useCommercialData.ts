import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface TrendPoint {
  date: string;
  sales: number;
  positivation: number;
}

interface RankingItem {
  id: string;
  name: string;
  value: number;
  variation: number;
  extra?: string;
}

interface CommercialData {
  trend: TrendPoint[];
  cityRanking: RankingItem[];
  sellerRanking: RankingItem[];
  buRanking: RankingItem[];
  channelRanking: RankingItem[];
}

function getMonthRange() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    today: today.toISOString().split('T')[0],
    monthStart: monthStart.toISOString().split('T')[0],
    prevMonthStart: prevMonthStart.toISOString().split('T')[0],
    prevMonthEnd: prevMonthEnd.toISOString().split('T')[0],
  };
}

async function fetchCommercialData(companyId: string): Promise<CommercialData> {
  const dates = getMonthRange();

  const { data: salesRows, error: salesErr } = await supabase
    .from('sales_fact_daily')
    .select('sale_date, net_value, client_id')
    .eq('company_id', companyId)
    .gte('sale_date', dates.monthStart)
    .lte('sale_date', dates.today);

  if (salesErr) throw new Error(salesErr.message);

  const { data: baseData } = await supabase
    .from('customer_base_snapshot')
    .select('client_count')
    .eq('company_id', companyId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseCount = baseData?.client_count || 1;
  const rows = salesRows || [];

  // Build daily trend
  const byDay = new Map<string, { sales: number; clients: Set<string> }>();
  for (const r of rows) {
    if (!byDay.has(r.sale_date)) byDay.set(r.sale_date, { sales: 0, clients: new Set() });
    const entry = byDay.get(r.sale_date)!;
    entry.sales += Number(r.net_value || 0);
    entry.clients.add(r.client_id);
  }

  const trend: TrendPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(date + 'T12:00:00')),
      sales: v.sales,
      positivation: Math.round((v.clients.size / baseCount) * 100 * 10) / 10,
    }));

  // Previous month for variation
  const { data: prevRows } = await supabase
    .from('sales_fact_daily')
    .select('net_value, client_id, channel_code, bu_id, city_id')
    .eq('company_id', companyId)
    .gte('sale_date', dates.prevMonthStart)
    .lte('sale_date', dates.prevMonthEnd);

  const prev = prevRows || [];

  // City ranking
  const { data: citySalesRows } = await supabase
    .from('sales_fact_daily')
    .select('city_id, net_value')
    .eq('company_id', companyId)
    .gte('sale_date', dates.monthStart)
    .lte('sale_date', dates.today)
    .not('city_id', 'is', null);

  const cityAgg = new Map<string, number>();
  for (const r of (citySalesRows || [])) {
    cityAgg.set(r.city_id!, (cityAgg.get(r.city_id!) || 0) + Number(r.net_value || 0));
  }

  const prevCityAgg = new Map<string, number>();
  for (const r of prev) {
    const cid = (r as any).city_id;
    if (cid) prevCityAgg.set(cid, (prevCityAgg.get(cid) || 0) + Number(r.net_value || 0));
  }

  const cityIds = Array.from(cityAgg.keys()).slice(0, 20);
  const { data: cityDims } = cityIds.length > 0
    ? await supabase.from('city_dim').select('id, name, uf').in('id', cityIds)
    : { data: [] };

  const cityNameMap = new Map((cityDims || []).map(c => [c.id, { name: c.name, uf: c.uf }]));

  const cityRanking: RankingItem[] = Array.from(cityAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, value]) => {
      const prevVal = prevCityAgg.get(id) || 0;
      const variation = prevVal > 0 ? ((value - prevVal) / prevVal) * 100 : 0;
      const city = cityNameMap.get(id);
      return { id, name: city?.name || 'Desconhecida', value, variation: Math.round(variation * 10) / 10, extra: city?.uf || '' };
    });

  // Seller ranking
  const clientIds = [...new Set(rows.map(r => r.client_id))];
  const { data: clientDims } = clientIds.length > 0
    ? await supabase.from('client_dim').select('id, seller_name, channel_code').in('id', clientIds.slice(0, 500))
    : { data: [] };

  const clientMap = new Map((clientDims || []).map(c => [c.id, { seller: c.seller_name || 'Sem vendedor', channel: c.channel_code || '' }]));

  const sellerAgg = new Map<string, { value: number; channel: string }>();
  for (const r of rows) {
    const info = clientMap.get(r.client_id);
    const seller = info?.seller || 'Sem vendedor';
    const existing = sellerAgg.get(seller) || { value: 0, channel: info?.channel || '' };
    existing.value += Number(r.net_value || 0);
    sellerAgg.set(seller, existing);
  }

  const sellerRanking: RankingItem[] = Array.from(sellerAgg.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10)
    .map(([name, { value, channel }], i) => ({
      id: String(i + 1), name, value, variation: 0, extra: channel,
    }));

  // BU ranking — tabela renomeada para cockpit_business_units no GA360
  const buAgg = new Map<string, number>();
  for (const r of rows) {
    const buId = (r as any).bu_id;
    if (buId) buAgg.set(buId, (buAgg.get(buId) || 0) + Number(r.net_value || 0));
  }

  const buIds = Array.from(buAgg.keys()).slice(0, 20);
  const { data: buDims } = buIds.length > 0
    ? await supabase.from('cockpit_business_units').select('id, name').in('id', buIds)
    : { data: [] };
  const buNameMap = new Map((buDims || []).map(b => [b.id, b.name]));

  const buRanking: RankingItem[] = Array.from(buAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, value]) => ({
      id, name: buNameMap.get(id) || id, value, variation: 0,
    }));

  // Channel ranking
  const channelAgg = new Map<string, number>();
  for (const r of rows) {
    const info = clientMap.get(r.client_id);
    const ch = info?.channel || (r as any).channel_code || 'Outros';
    channelAgg.set(ch, (channelAgg.get(ch) || 0) + Number(r.net_value || 0));
  }

  const channelLabels: Record<string, string> = { KA: 'Key Account', AS: 'Auto Serviço', TRAD: 'Tradicional' };
  const channelRanking: RankingItem[] = Array.from(channelAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, value], i) => ({
      id: String(i + 1), name: channelLabels[code] || code, value, variation: 0,
    }));

  return { trend, cityRanking, sellerRanking, buRanking, channelRanking };
}

export function useCommercialData() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: ['commercial-data', companyId],
    queryFn: () => fetchCommercialData(companyId!),
    staleTime: 1000 * 60 * 5,
    enabled: !!companyId,
    retry: 1,
  });
}
