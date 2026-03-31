import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

interface AttackClient {
  clientId: string;
  clientCode: string;
  clientName: string;
  cityName: string;
  uf: string;
  channelCode: string;
  sellerName: string;
  potentialScore: number;
  lastPurchaseDate: string | null;
  daysSinceLastPurchase: number | null;
}

interface AttackListResponse {
  clients: AttackClient[];
  total: number;
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
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    console.log('Parameters:', { companyId, cityId, startDate, endDate, channelCode, limit });

    if (!companyId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: company_id, start_date, end_date' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 5. Get all active clients
    let clientsQuery = supabase
      .from('client_dim')
      .select('id, code, name, channel_code, seller_name, potential_score, last_purchase_date, city_id')
      .eq('company_id', companyId)
      .eq('is_active', true);  // GA360 convention: is_active (not active)

    if (cityId) {
      clientsQuery = clientsQuery.eq('city_id', cityId);
    }

    if (channelCode !== 'ALL') {
      clientsQuery = clientsQuery.eq('channel_code', channelCode);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      console.error('Clients query error:', clientsError);
      throw clientsError;
    }

    console.log(`Found ${clients?.length || 0} active clients`);

    // Also get cities separately to map them
    const { data: allCities } = await supabase
      .from('city_dim')
      .select('id, name, uf');

    const cityMap = new Map<string, { name: string; uf: string }>();
    allCities?.forEach(c => cityMap.set(c.id, { name: c.name, uf: c.uf }));

    // 6. Get sales in period to find positivated clients
    let salesQuery = supabase
      .from('sales_fact_daily')
      .select('client_id')
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

    // 7. Get positivated client IDs
    const positivatedIds = new Set(sales?.map(s => s.client_id));

    // 8. Filter to non-positivated clients
    const today = new Date();
    const attackClients: AttackClient[] = (clients || [])
      .filter(c => !positivatedIds.has(c.id))
      .map(c => {
        const lastPurchase = c.last_purchase_date ? new Date(c.last_purchase_date) : null;
        const daysSince = lastPurchase
          ? Math.floor((today.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const cityInfo = c.city_id ? cityMap.get(c.city_id) : null;

        return {
          clientId: c.id,
          clientCode: c.code || '',
          clientName: c.name,
          cityName: cityInfo?.name || '',
          uf: cityInfo?.uf || '',
          channelCode: c.channel_code || '',
          sellerName: c.seller_name || '',
          potentialScore: c.potential_score || 50,
          lastPurchaseDate: c.last_purchase_date,
          daysSinceLastPurchase: daysSince,
        };
      })
      // Sort by potential score (desc), then days since last purchase (desc)
      .sort((a, b) => {
        if (b.potentialScore !== a.potentialScore) {
          return b.potentialScore - a.potentialScore;
        }
        const daysA = a.daysSinceLastPurchase ?? 999;
        const daysB = b.daysSinceLastPurchase ?? 999;
        return daysB - daysA;
      });

    const total = attackClients.length;
    const limitedClients = attackClients.slice(0, limit);

    // 9. Build response
    const response: AttackListResponse = {
      clients: limitedClients,
      total,
    };

    console.log('Attack List response:', { total, returned: limitedClients.length });

    return new Response(
      JSON.stringify(response),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    console.error('Error in attack-list:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
