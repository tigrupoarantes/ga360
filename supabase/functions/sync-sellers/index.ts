import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface SellerRecord {
  distributor_code: string;
  sale_date: string;
  seller_code: string;
  seller_name?: string;
  total_customers: number;
  active_customers: number;
  total_value: number;
}

interface SyncRequest {
  company_external_id: string;
  sellers: SellerRecord[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  console.log(`[sync-sellers] Starting sync at ${startTime.toISOString()}`);

  try {
    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[sync-sellers] Invalid or missing API key');
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
    console.log(`[sync-sellers] Received ${body.sellers?.length || 0} records for company: ${body.company_external_id}`);

    if (!body.company_external_id || !body.sellers || !Array.isArray(body.sellers)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Required: company_external_id, sellers[]' }),
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
      console.error('[sync-sellers] Company not found:', body.company_external_id, companyError);
      return new Response(
        JSON.stringify({ error: `Company not found: ${body.company_external_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = company.id;
    console.log(`[sync-sellers] Found company ID: ${companyId}`);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        company_id: companyId,
        sync_type: 'sellers',
        records_received: body.sellers.length,
        status: 'running'
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('[sync-sellers] Error creating sync log:', syncLogError);
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: any[] = [];

    // Cache distributors
    const distributorCache: Record<string, string> = {};

    for (const seller of body.sellers) {
      try {
        // Get distributor
        let distributorId = distributorCache[seller.distributor_code];

        if (!distributorId) {
          const { data: existingDist } = await supabase
            .from('distributors')
            .select('id')
            .eq('company_id', companyId)
            .eq('external_id', seller.distributor_code)
            .maybeSingle();

          if (existingDist) {
            distributorId = existingDist.id;
            distributorCache[seller.distributor_code] = distributorId;
          } else {
            throw new Error(`Distributor not found: ${seller.distributor_code}. Please sync sales first.`);
          }
        }

        // Check if seller record exists for this date
        const { data: existingSeller } = await supabase
          .from('sales_sellers')
          .select('id')
          .eq('company_id', companyId)
          .eq('distributor_id', distributorId)
          .eq('sale_date', seller.sale_date)
          .eq('seller_code', seller.seller_code)
          .maybeSingle();

        if (existingSeller) {
          // Update existing
          const { error: updateError } = await supabase
            .from('sales_sellers')
            .update({
              seller_name: seller.seller_name,
              total_customers: seller.total_customers,
              active_customers: seller.active_customers,
              total_value: seller.total_value,
              synced_at: new Date().toISOString()
            })
            .eq('id', existingSeller.id);

          if (updateError) throw updateError;
          updated++;
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('sales_sellers')
            .insert({
              company_id: companyId,
              distributor_id: distributorId,
              sale_date: seller.sale_date,
              seller_code: seller.seller_code,
              seller_name: seller.seller_name,
              total_customers: seller.total_customers,
              active_customers: seller.active_customers,
              total_value: seller.total_value
            });

          if (insertError) throw insertError;
          created++;
        }
      } catch (error) {
        failed++;
        errors.push({ seller_code: seller.seller_code, date: seller.sale_date, error: String(error) });
        console.error(`[sync-sellers] Error processing seller ${seller.seller_code}:`, error);
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

    const result = {
      success: true,
      records_received: body.sellers.length,
      created,
      updated,
      failed,
      duration_ms: durationMs,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`[sync-sellers] Completed: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-sellers] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
