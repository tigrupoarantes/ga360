import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface SaleRecord {
  external_id: string;
  distributor_code: string;
  distributor_name?: string;
  sale_date: string;
  product_code?: string;
  product_name?: string;
  product_category?: string;
  quantity: number;
  total_value: number;
  customers_served?: number;
}

interface SyncRequest {
  company_external_id: string;
  sales: SaleRecord[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  console.log(`[sync-sales] Starting sync at ${startTime.toISOString()}`);

  try {
    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[sync-sales] Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: SyncRequest = await req.json();
    console.log(`[sync-sales] Received ${body.sales?.length || 0} records for company: ${body.company_external_id}`);

    if (!body.company_external_id || !body.sales || !Array.isArray(body.sales)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Required: company_external_id, sales[]' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find company by external_id
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('external_id', body.company_external_id)
      .maybeSingle();

    if (companyError || !company) {
      console.error('[sync-sales] Company not found:', body.company_external_id, companyError);
      return new Response(
        JSON.stringify({ error: `Company not found: ${body.company_external_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = company.id;
    console.log(`[sync-sales] Found company ID: ${companyId}`);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        company_id: companyId,
        sync_type: 'sales',
        records_received: body.sales.length,
        status: 'running'
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('[sync-sales] Error creating sync log:', syncLogError);
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: any[] = [];

    // Cache distributors to avoid repeated lookups
    const distributorCache: Record<string, string> = {};

    for (const sale of body.sales) {
      try {
        // Get or create distributor
        let distributorId = distributorCache[sale.distributor_code];

        if (!distributorId) {
          // Try to find existing distributor
          const { data: existingDist } = await supabase
            .from('distributors')
            .select('id')
            .eq('company_id', companyId)
            .eq('external_id', sale.distributor_code)
            .maybeSingle();

          if (existingDist) {
            distributorId = existingDist.id;
          } else {
            // Create new distributor
            const { data: newDist, error: distError } = await supabase
              .from('distributors')
              .insert({
                company_id: companyId,
                external_id: sale.distributor_code,
                code: sale.distributor_code,
                name: sale.distributor_name || sale.distributor_code
              })
              .select()
              .single();

            if (distError) {
              console.error('[sync-sales] Error creating distributor:', distError);
              throw new Error(`Failed to create distributor: ${sale.distributor_code}`);
            }
            distributorId = newDist.id;
            console.log(`[sync-sales] Created new distributor: ${sale.distributor_code}`);
          }
          distributorCache[sale.distributor_code] = distributorId;
        }

        // Check if sale exists
        const { data: existingSale } = await supabase
          .from('sales_daily')
          .select('id')
          .eq('company_id', companyId)
          .eq('external_id', sale.external_id)
          .maybeSingle();

        if (existingSale) {
          // Update existing sale
          const { error: updateError } = await supabase
            .from('sales_daily')
            .update({
              distributor_id: distributorId,
              sale_date: sale.sale_date,
              product_code: sale.product_code,
              product_name: sale.product_name,
              product_category: sale.product_category,
              quantity: sale.quantity,
              total_value: sale.total_value,
              customers_served: sale.customers_served || 0,
              synced_at: new Date().toISOString()
            })
            .eq('id', existingSale.id);

          if (updateError) throw updateError;
          updated++;
        } else {
          // Insert new sale
          const { error: insertError } = await supabase
            .from('sales_daily')
            .insert({
              company_id: companyId,
              distributor_id: distributorId,
              external_id: sale.external_id,
              sale_date: sale.sale_date,
              product_code: sale.product_code,
              product_name: sale.product_name,
              product_category: sale.product_category,
              quantity: sale.quantity,
              total_value: sale.total_value,
              customers_served: sale.customers_served || 0
            });

          if (insertError) throw insertError;
          created++;
        }
      } catch (error) {
        failed++;
        errors.push({ external_id: sale.external_id, error: String(error) });
        console.error(`[sync-sales] Error processing sale ${sale.external_id}:`, error);
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // Update sync log
    if (syncLog) {
      await supabase
        .from('sync_logs')
        .update({
          records_created: created,
          records_updated: updated,
          records_failed: failed,
          errors: errors.length > 0 ? errors : null,
          completed_at: endTime.toISOString(),
          status: failed > 0 ? 'partial' : 'success'
        })
        .eq('id', syncLog.id);
    }

    // Trigger goal recalculation
    console.log('[sync-sales] Triggering goal recalculation...');
    try {
      const recalcResponse = await fetch(`${supabaseUrl}/functions/v1/recalculate-goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'x-api-key': apiKey
        },
        body: JSON.stringify({ company_id: companyId })
      });
      console.log('[sync-sales] Goal recalculation response:', recalcResponse.status);
    } catch (recalcError) {
      console.error('[sync-sales] Error triggering recalculation:', recalcError);
    }

    const result = {
      success: true,
      records_received: body.sales.length,
      created,
      updated,
      failed,
      duration_ms: durationMs,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`[sync-sales] Completed: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-sales] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
