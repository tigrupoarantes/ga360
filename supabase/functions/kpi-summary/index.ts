import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

interface KPISummaryResponse {
  salesDTD: number;
  salesWTD: number;
  salesMTD: number;
  salesVariation: number;
  positivationCount: number;
  positivationTotal: number;
  positivationPercent: number;
  positivationVariation: number;
  coverageCount: number;
  coverageTotal: number;
  coveragePercent: number;
  coverageIsProxy: boolean;
  ordersCount: number;
  ordersVariation: number;
  ticketAvg: number;
  ticketVariation: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 1. Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create Supabase client with user's token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 3. Log request (JWT verification is disabled - RLS protects data)
    console.log('Processing request with auth header');

    // 4. Extract query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get('company_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const channelCode = url.searchParams.get('channel_code') || 'ALL';
    const buId = url.searchParams.get('bu_id');
    const industryId = url.searchParams.get('industry_id');
    // Note: uf filter not applied directly on sales_fact_daily (no uf column).
    // UF filtering is done via city_dim join — handled in geo-heatmap endpoint.

    console.log('Parameters:', { companyId, startDate, endDate, channelCode, buId, industryId });

    if (!companyId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: company_id, start_date, end_date' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 5. Calculate date ranges
    const end = new Date(endDate);
    const start = new Date(startDate);

    // DTD = today only
    const todayStr = end.toISOString().split('T')[0];

    // WTD = start of current week (Monday) to end date
    const dayOfWeek = end.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(end);
    weekStart.setDate(end.getDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // MTD = start of current month to end date
    const monthStart = new Date(end.getFullYear(), end.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Previous period for variation (same length as current period, immediately before)
    const periodLength = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - periodLength);
    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr = prevEnd.toISOString().split('T')[0];

    // 6. Build base query filter
    let salesQuery = supabase
      .from('sales_fact_daily')
      .select('sale_date, client_id, net_value, order_count');

    // Apply filters
    salesQuery = salesQuery.eq('company_id', companyId);

    if (channelCode !== 'ALL') {
      salesQuery = salesQuery.eq('channel_code', channelCode);
    }
    if (buId) {
      salesQuery = salesQuery.eq('bu_id', buId);
    }
    if (industryId) {
      salesQuery = salesQuery.eq('industry_id', industryId);
    }

    // Get MTD data (includes DTD and WTD)
    const { data: mtdSales, error: salesError } = await salesQuery
      .gte('sale_date', monthStartStr)
      .lte('sale_date', todayStr);

    if (salesError) {
      console.error('Sales query error:', salesError);
      throw salesError;
    }

    console.log(`Found ${mtdSales?.length || 0} sales records for MTD`);

    // 7. Calculate sales aggregates
    const salesDTD = mtdSales
      ?.filter(s => s.sale_date === todayStr)
      .reduce((sum, s) => sum + (s.net_value || 0), 0) || 0;

    const salesWTD = mtdSales
      ?.filter(s => s.sale_date >= weekStartStr && s.sale_date <= todayStr)
      .reduce((sum, s) => sum + (s.net_value || 0), 0) || 0;

    const salesMTD = mtdSales
      ?.reduce((sum, s) => sum + (s.net_value || 0), 0) || 0;

    // 8. Calculate orders
    const ordersCount = mtdSales
      ?.filter(s => s.sale_date >= startDate && s.sale_date <= endDate)
      .reduce((sum, s) => sum + (s.order_count || 0), 0) || 0;

    // 9. Calculate positivation (unique clients with purchases)
    const positivatedClients = new Set(
      mtdSales
        ?.filter(s => s.sale_date >= startDate && s.sale_date <= endDate)
        .map(s => s.client_id)
    );
    const positivationCount = positivatedClients.size;

    // 10. Get customer base total
    const { data: baseData, error: baseError } = await supabase
      .from('customer_base_snapshot')
      .select('client_count')
      .eq('company_id', companyId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (baseError && baseError.code !== 'PGRST116') {
      console.log('Customer base query note:', baseError.message);
    }

    const positivationTotal = baseData?.client_count || positivationCount;
    const positivationPercent = positivationTotal > 0
      ? (positivationCount / positivationTotal) * 100
      : 0;

    // 11. Get previous period data for variation calculation
    let prevSalesQuery = supabase
      .from('sales_fact_daily')
      .select('client_id, net_value, order_count')
      .eq('company_id', companyId)
      .gte('sale_date', prevStartStr)
      .lte('sale_date', prevEndStr);

    if (channelCode !== 'ALL') {
      prevSalesQuery = prevSalesQuery.eq('channel_code', channelCode);
    }
    if (buId) {
      prevSalesQuery = prevSalesQuery.eq('bu_id', buId);
    }
    if (industryId) {
      prevSalesQuery = prevSalesQuery.eq('industry_id', industryId);
    }

    const { data: prevSales } = await prevSalesQuery;

    const prevSalesTotal = prevSales?.reduce((sum, s) => sum + (s.net_value || 0), 0) || 0;
    const prevOrdersCount = prevSales?.reduce((sum, s) => sum + (s.order_count || 0), 0) || 0;
    const prevPositivatedClients = new Set(prevSales?.map(s => s.client_id));
    const prevPositivationCount = prevPositivatedClients.size;

    // 12. Calculate variations
    const currentPeriodSales = mtdSales
      ?.filter(s => s.sale_date >= startDate && s.sale_date <= endDate)
      .reduce((sum, s) => sum + (s.net_value || 0), 0) || 0;

    const salesVariation = prevSalesTotal > 0
      ? ((currentPeriodSales - prevSalesTotal) / prevSalesTotal) * 100
      : 0;

    const ordersVariation = prevOrdersCount > 0
      ? ((ordersCount - prevOrdersCount) / prevOrdersCount) * 100
      : 0;

    const prevPositivationPercent = positivationTotal > 0
      ? (prevPositivationCount / positivationTotal) * 100
      : 0;
    const positivationVariation = prevPositivationPercent > 0
      ? ((positivationPercent - prevPositivationPercent) / prevPositivationPercent) * 100
      : 0;

    // 13. Calculate ticket average
    const ticketAvg = ordersCount > 0 ? currentPeriodSales / ordersCount : 0;
    const prevTicketAvg = prevOrdersCount > 0 ? prevSalesTotal / prevOrdersCount : 0;
    const ticketVariation = prevTicketAvg > 0
      ? ((ticketAvg - prevTicketAvg) / prevTicketAvg) * 100
      : 0;

    // 14. Build response
    const response: KPISummaryResponse = {
      salesDTD: Math.round(salesDTD),
      salesWTD: Math.round(salesWTD),
      salesMTD: Math.round(salesMTD),
      salesVariation: Number(salesVariation.toFixed(1)),
      positivationCount,
      positivationTotal,
      positivationPercent: Number(positivationPercent.toFixed(1)),
      positivationVariation: Number(positivationVariation.toFixed(1)),
      coverageCount: positivationCount, // Using positivation as proxy
      coverageTotal: positivationTotal,
      coveragePercent: Number(positivationPercent.toFixed(1)),
      coverageIsProxy: true,
      ordersCount,
      ordersVariation: Number(ordersVariation.toFixed(1)),
      ticketAvg: Math.round(ticketAvg),
      ticketVariation: Number(ticketVariation.toFixed(1)),
    };

    console.log('KPI Summary response:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    console.error('Error in kpi-summary:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
