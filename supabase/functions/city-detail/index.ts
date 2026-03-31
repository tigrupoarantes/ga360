import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

interface ClientAttack {
  clientId: string;
  clientCode: string;
  clientName: string;
  channelCode: string;
  sellerName: string;
  potentialScore: number;
  daysSinceLastPurchase: number | null;
}

interface CityDetailResponse {
  cityId: string;
  cityName: string;
  uf: string;
  kpis: {
    positivationPercent: number;
    coveragePercent: number;
    salesTotal: number;
    baseClients: number;
    positivatedClients: number;
    ordersCount: number;
    ticketAvg: number;
  };
  nonPositivatedClients: ClientAttack[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 1. Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create Supabase client
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
    const cityId = url.searchParams.get('city_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const channelCode = url.searchParams.get('channel_code') || 'ALL';

    console.log('Parameters:', { companyId, cityId, startDate, endDate, channelCode });

    if (!companyId || !cityId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: company_id, city_id, start_date, end_date' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 5. Get city info
    const { data: city, error: cityError } = await supabase
      .from('city_dim')
      .select('id, name, uf')
      .eq('id', cityId)
      .single();

    if (cityError || !city) {
      return new Response(
        JSON.stringify({ error: 'City not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 6. Get all clients in this city
    let clientsQuery = supabase
      .from('client_dim')
      .select('id, code, name, channel_code, seller_name, potential_score, last_purchase_date')
      .eq('company_id', companyId)
      .eq('city_id', cityId)
      .eq('is_active', true);  // GA360 convention: is_active (not active)

    if (channelCode !== 'ALL') {
      clientsQuery = clientsQuery.eq('channel_code', channelCode);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      console.error('Clients query error:', clientsError);
      throw clientsError;
    }

    console.log(`Found ${clients?.length || 0} clients in city`);

    // 7. Get sales for this city in period
    let salesQuery = supabase
      .from('sales_fact_daily')
      .select('client_id, net_value, order_count')
      .eq('company_id', companyId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (channelCode !== 'ALL') {
      salesQuery = salesQuery.eq('channel_code', channelCode);
    }

    const { data: sales, error: salesError } = await salesQuery;

    if (salesError) {
      console.error('Sales query error:', salesError);
      throw salesError;
    }

    // 8. Filter sales to clients in this city
    const clientIds = new Set(clients?.map(c => c.id));
    const citySales = sales?.filter(s => clientIds.has(s.client_id)) || [];

    // 9. Calculate KPIs
    const positivatedClientIds = new Set(citySales.map(s => s.client_id));
    const positivatedClients = positivatedClientIds.size;
    const baseClients = clients?.length || 0;
    const positivationPercent = baseClients > 0 ? (positivatedClients / baseClients) * 100 : 0;

    const salesTotal = citySales.reduce((sum, s) => sum + (s.net_value || 0), 0);
    const ordersCount = citySales.reduce((sum, s) => sum + (s.order_count || 0), 0);
    const ticketAvg = ordersCount > 0 ? salesTotal / ordersCount : 0;

    // 10. Get non-positivated clients
    const today = new Date();
    const nonPositivatedClients: ClientAttack[] = (clients || [])
      .filter(c => !positivatedClientIds.has(c.id))
      .map(c => {
        const lastPurchase = c.last_purchase_date ? new Date(c.last_purchase_date) : null;
        const daysSince = lastPurchase
          ? Math.floor((today.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          clientId: c.id,
          clientCode: c.code || '',
          clientName: c.name,
          channelCode: c.channel_code || '',
          sellerName: c.seller_name || '',
          potentialScore: c.potential_score || 50,
          daysSinceLastPurchase: daysSince,
        };
      })
      .sort((a, b) => b.potentialScore - a.potentialScore)
      .slice(0, 50); // Limit to top 50

    // 11. Build response
    const response: CityDetailResponse = {
      cityId: city.id,
      cityName: city.name,
      uf: city.uf,
      kpis: {
        positivationPercent: Number(positivationPercent.toFixed(1)),
        coveragePercent: Number(positivationPercent.toFixed(1)),
        salesTotal: Math.round(salesTotal),
        baseClients,
        positivatedClients,
        ordersCount,
        ticketAvg: Math.round(ticketAvg),
      },
      nonPositivatedClients,
    };

    console.log('City Detail response:', { cityName: city.name, baseClients, positivatedClients });

    return new Response(
      JSON.stringify(response),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    console.error('Error in city-detail:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
