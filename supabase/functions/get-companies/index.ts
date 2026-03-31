import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

interface DatalakeCompany {
  code: string;
  name: string;
  businessType: 'distributor' | 'retail' | 'hybrid';
  segmentMode: 'bu' | 'industry' | 'store' | 'category';
  industries?: { code: string; name: string }[];
  stores?: { code: string; name: string; type: 'store' | 'dc' }[];
  businessUnits?: { code: string; name: string; industryCode: string }[];
}

// Resolves API key from dl_connections record
// dl_connections stores credentials in auth_config_json and headers_json (instead of plain api_key column)
function resolveApiKey(record: Record<string, any>): string | undefined {
  const headersJson = record.headers_json || {};
  const authConfigJson = record.auth_config_json || {};
  return (
    authConfigJson.apiKey ||
    authConfigJson.api_key ||
    headersJson['X-API-Key'] ||
    headersJson['x-api-key'] ||
    undefined
  );
}

// Resolves auth header value from dl_connections record (for bearer token auth)
function resolveBearerToken(record: Record<string, any>): string | undefined {
  const authConfigJson = record.auth_config_json || {};
  if (authConfigJson.bearerToken) return `Bearer ${authConfigJson.bearerToken}`;
  if (authConfigJson.token) return `Bearer ${authConfigJson.token}`;
  return undefined;
}

// Resolves custom auth header name from dl_connections record
function resolveAuthHeaderName(record: Record<string, any>): string | undefined {
  const authConfigJson = record.auth_config_json || {};
  return authConfigJson.authHeaderName || undefined;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Fetch active DAB connection from dl_connections (GA360 unified connection table)
    // We look for a connection of type 'api_proxy' or any enabled connection with a base_url
    const { data: dlConnection, error: connError } = await supabase
      .from('dl_connections')
      .select('*')
      .eq('is_enabled', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connError || !dlConnection) {
      console.log('No active dl_connection found, returning mock data');

      const mockCompanies: DatalakeCompany[] = [
        {
          code: '2',
          name: 'Chok Distribuidora',
          businessType: 'distributor',
          segmentMode: 'industry',
          industries: [
            { code: 'NESTLE', name: 'Nestlé' },
            { code: 'MONDELEZ', name: 'Mondelez' },
            { code: 'PEPSICO', name: 'PepsiCo' },
          ],
        },
        {
          code: '3',
          name: 'Broker Jarantes',
          businessType: 'distributor',
          segmentMode: 'bu',
          industries: [{ code: 'NESTLE', name: 'Nestlé' }],
          businessUnits: [
            { code: 'LSECA', name: 'Linha Seca', industryCode: 'NESTLE' },
            { code: 'GATOR', name: 'Gatorade', industryCode: 'NESTLE' },
            { code: 'SORV', name: 'Sorvetes', industryCode: 'NESTLE' },
          ],
        },
        {
          code: '4',
          name: 'G4 Distribuição',
          businessType: 'distributor',
          segmentMode: 'bu',
          industries: [{ code: 'UNILEVER', name: 'Unilever' }],
          businessUnits: [
            { code: 'SORV', name: 'Sorvetes', industryCode: 'UNILEVER' },
            { code: 'KIBON', name: 'Kibon', industryCode: 'UNILEVER' },
          ],
        },
        {
          code: '5',
          name: 'Chokdoce',
          businessType: 'retail',
          segmentMode: 'store',
          stores: [
            { code: 'LJ001', name: 'Loja Centro', type: 'store' },
            { code: 'LJ002', name: 'Loja Shopping', type: 'store' },
            { code: 'LJ003', name: 'Loja Bairro', type: 'store' },
            { code: 'CD01', name: 'CD Principal', type: 'dc' },
          ],
        },
      ];

      return new Response(
        JSON.stringify({ companies: mockCompanies }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = (dlConnection.base_url || '').replace(/\/+$/, '');
    console.log('Fetching from Datalake API:', baseUrl);

    // Build auth headers from dl_connections record
    // Credentials are stored in auth_config_json and headers_json (GA360 convention)
    const datalakeHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(dlConnection.headers_json || {}),
    };

    const apiKey = resolveApiKey(dlConnection);
    const bearerToken = resolveBearerToken(dlConnection);
    const authHeaderName = resolveAuthHeaderName(dlConnection);

    if (dlConnection.auth_type === 'bearer' && bearerToken) {
      datalakeHeaders['Authorization'] = bearerToken;
    } else if (dlConnection.auth_type === 'bearer' && apiKey) {
      datalakeHeaders['Authorization'] = `Bearer ${apiKey}`;
    } else if (dlConnection.auth_type === 'api_key' && apiKey) {
      datalakeHeaders[authHeaderName || 'X-API-Key'] = apiKey;
    } else if (dlConnection.auth_type === 'basic' && apiKey) {
      datalakeHeaders['Authorization'] = `Basic ${apiKey}`;
    }

    // Call Datalake API
    const datalakeUrl = `${baseUrl}/companies`;
    console.log('Calling Datalake:', datalakeUrl);

    const datalakeResponse = await fetch(datalakeUrl, {
      method: 'GET',
      headers: datalakeHeaders,
    });

    if (!datalakeResponse.ok) {
      const errorText = await datalakeResponse.text();
      console.error('Datalake API error:', datalakeResponse.status, errorText);

      // Update sync status on dl_connections
      await supabase
        .from('dl_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'error',
        })
        .eq('id', dlConnection.id);

      return new Response(
        JSON.stringify({ error: 'Failed to fetch from Datalake API' }),
        { status: 502, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const datalakeData = await datalakeResponse.json();
    console.log('Datalake response received:', JSON.stringify(datalakeData).substring(0, 200));

    // DAB returns { value: [...] } — normalize to { companies: [...] }
    const companies = Array.isArray(datalakeData.value) ? datalakeData.value : [];

    // Update sync status to success on dl_connections
    await supabase
      .from('dl_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
      })
      .eq('id', dlConnection.id);

    return new Response(
      JSON.stringify({ companies }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
