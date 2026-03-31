import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

interface CityPoint {
  cityId: string;
  cityName: string;
  uf: string;
  lat: number;
  lng: number;
  positivationPercent: number;
  coveragePercent: number;
  salesTotal: number;
  baseClients: number;
  positivatedClients: number;
}

interface GeoHeatmapResponse {
  points: CityPoint[];
  summary: {
    avgPositivation: number;
    totalCities: number;
    totalSales: number;
  };
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
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const channelCode = url.searchParams.get('channel_code') || 'ALL';
    const buId = url.searchParams.get('bu_id');
    const industryId = url.searchParams.get('industry_id');
    const ufFilter = url.searchParams.get('uf');

    console.log('Parameters:', { companyId, startDate, endDate, channelCode, buId, industryId, ufFilter });

    if (!companyId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: company_id, start_date, end_date' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 5. Get all cities for the company
    let citiesQuery = supabase
      .from('city_dim')
      .select('id, name, uf, lat, lng');

    if (ufFilter) {
      citiesQuery = citiesQuery.eq('uf', ufFilter);
    }

    const { data: cities, error: citiesError } = await citiesQuery;

    if (citiesError) {
      console.error('Cities query error:', citiesError);
      throw citiesError;
    }

    console.log(`Found ${cities?.length || 0} cities`);

    // 6. Get client to city mapping first
    const { data: clientsWithCity, error: clientsError } = await supabase
      .from('client_dim')
      .select('id, city_id')
      .eq('company_id', companyId);

    if (clientsError) {
      console.error('Clients query error:', clientsError);
      throw clientsError;
    }

    const clientToCityMap = new Map<string, string>();
    clientsWithCity?.forEach(c => {
      if (c.city_id) clientToCityMap.set(c.id, c.city_id);
    });

    // 7. Get sales data
    let salesQuery = supabase
      .from('sales_fact_daily')
      .select('client_id, net_value, order_count')
      .eq('company_id', companyId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (channelCode !== 'ALL') {
      salesQuery = salesQuery.eq('channel_code', channelCode);
    }
    if (buId) {
      salesQuery = salesQuery.eq('bu_id', buId);
    }
    if (industryId) {
      salesQuery = salesQuery.eq('industry_id', industryId);
    }

    const { data: sales, error: salesError } = await salesQuery;

    if (salesError) {
      console.error('Sales query error:', salesError);
      throw salesError;
    }

    // 8. Get customer base by city
    const { data: baseCounts } = await supabase
      .from('customer_base_snapshot')
      .select('city_id, client_count')
      .eq('company_id', companyId)
      .order('snapshot_date', { ascending: false });

    // Group base counts by city (take latest snapshot per city)
    const baseByCity = new Map<string, number>();
    baseCounts?.forEach(b => {
      if (!baseByCity.has(b.city_id)) {
        baseByCity.set(b.city_id, b.client_count || 0);
      }
    });

    // 9. Aggregate sales by city
    const cityMetrics = new Map<string, { sales: number; clients: Set<string>; orders: number }>();

    sales?.forEach(sale => {
      const cityId = clientToCityMap.get(sale.client_id);
      if (!cityId) return;

      if (!cityMetrics.has(cityId)) {
        cityMetrics.set(cityId, { sales: 0, clients: new Set(), orders: 0 });
      }
      const metrics = cityMetrics.get(cityId)!;
      metrics.sales += sale.net_value || 0;
      metrics.clients.add(sale.client_id);
      metrics.orders += sale.order_count || 0;
    });

    // 10. Build response
    const points: CityPoint[] = [];
    let totalSales = 0;
    let totalPositivation = 0;
    let citiesWithData = 0;

    cities?.forEach(city => {
      const metrics = cityMetrics.get(city.id);
      const baseClients = baseByCity.get(city.id) || 0;
      const positivatedClients = metrics?.clients.size || 0;
      const salesTotal = metrics?.sales || 0;

      // Only include cities with base clients or sales
      if (baseClients > 0 || positivatedClients > 0) {
        const positivationPercent = baseClients > 0
          ? (positivatedClients / baseClients) * 100
          : (positivatedClients > 0 ? 100 : 0);

        points.push({
          cityId: city.id,
          cityName: city.name,
          uf: city.uf,
          lat: city.lat || 0,
          lng: city.lng || 0,
          positivationPercent: Number(positivationPercent.toFixed(1)),
          coveragePercent: Number(positivationPercent.toFixed(1)), // positivation as proxy
          salesTotal: Math.round(salesTotal),
          baseClients,
          positivatedClients,
        });

        totalSales += salesTotal;
        totalPositivation += positivationPercent;
        citiesWithData++;
      }
    });

    // Sort by positivation desc
    points.sort((a, b) => b.positivationPercent - a.positivationPercent);

    const geoResponse: GeoHeatmapResponse = {
      points,
      summary: {
        avgPositivation: citiesWithData > 0 ? Number((totalPositivation / citiesWithData).toFixed(1)) : 0,
        totalCities: points.length,
        totalSales: Math.round(totalSales),
      },
    };

    console.log('Geo Heatmap response:', { citiesCount: points.length, totalSales });

    return new Response(
      JSON.stringify(geoResponse),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    console.error('Error in geo-heatmap:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
