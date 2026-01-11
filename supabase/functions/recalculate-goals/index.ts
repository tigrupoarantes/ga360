import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface RecalculateRequest {
  company_id?: string;
  goal_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[recalculate-goals] Starting recalculation at ${new Date().toISOString()}`);

  try {
    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[recalculate-goals] Invalid or missing API key');
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
    const body: RecalculateRequest = await req.json();
    console.log(`[recalculate-goals] Request params:`, body);

    // Build goals query
    let goalsQuery = supabase
      .from('goals')
      .select('id, company_id, start_date, end_date, distributor_id, metric_type, product_filter, target_value')
      .eq('auto_calculate', true)
      .in('status', ['active', 'on_track', 'at_risk']);

    if (body.company_id) {
      goalsQuery = goalsQuery.eq('company_id', body.company_id);
    }
    if (body.goal_id) {
      goalsQuery = goalsQuery.eq('id', body.goal_id);
    }

    const { data: goals, error: goalsError } = await goalsQuery;

    if (goalsError) {
      console.error('[recalculate-goals] Error fetching goals:', goalsError);
      throw goalsError;
    }

    console.log(`[recalculate-goals] Found ${goals?.length || 0} goals to recalculate`);

    let updated = 0;
    let failed = 0;
    const results: any[] = [];

    for (const goal of goals || []) {
      try {
        let newValue = 0;
        const metricType = goal.metric_type || 'value';

        // Build sales query based on metric type
        if (metricType === 'coverage') {
          // Coverage: active_customers / total_customers from sales_sellers
          let sellersQuery = supabase
            .from('sales_sellers')
            .select('total_customers, active_customers')
            .eq('company_id', goal.company_id)
            .gte('sale_date', goal.start_date)
            .lte('sale_date', goal.end_date);

          if (goal.distributor_id) {
            sellersQuery = sellersQuery.eq('distributor_id', goal.distributor_id);
          }

          const { data: sellersData, error: sellersError } = await sellersQuery;

          if (sellersError) throw sellersError;

          if (sellersData && sellersData.length > 0) {
            const totalCustomers = sellersData.reduce((sum, s) => sum + (s.total_customers || 0), 0);
            const activeCustomers = sellersData.reduce((sum, s) => sum + (s.active_customers || 0), 0);
            newValue = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;
          }
        } else {
          // Other metrics from sales_daily
          let salesQuery = supabase
            .from('sales_daily')
            .select('quantity, total_value, customers_served, product_code, product_category')
            .eq('company_id', goal.company_id)
            .gte('sale_date', goal.start_date)
            .lte('sale_date', goal.end_date);

          if (goal.distributor_id) {
            salesQuery = salesQuery.eq('distributor_id', goal.distributor_id);
          }

          const { data: salesData, error: salesError } = await salesQuery;

          if (salesError) throw salesError;

          // Apply product filter if specified
          let filteredSales = salesData || [];
          if (goal.product_filter) {
            const filter = goal.product_filter.toLowerCase();
            filteredSales = filteredSales.filter(s => 
              (s.product_code && s.product_code.toLowerCase().includes(filter)) ||
              (s.product_category && s.product_category.toLowerCase().includes(filter))
            );
          }

          // Calculate based on metric type
          switch (metricType) {
            case 'value':
              newValue = filteredSales.reduce((sum, s) => sum + (Number(s.total_value) || 0), 0);
              break;
            case 'volume':
              newValue = filteredSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
              break;
            case 'customers':
              // Count unique customers served
              newValue = filteredSales.reduce((sum, s) => sum + (s.customers_served || 0), 0);
              break;
            default:
              newValue = filteredSales.reduce((sum, s) => sum + (Number(s.total_value) || 0), 0);
          }
        }

        // Determine new status based on progress
        const progress = goal.target_value > 0 ? (newValue / goal.target_value) * 100 : 0;
        let newStatus = 'active';
        if (progress >= 100) {
          newStatus = 'completed';
        } else if (progress >= 70) {
          newStatus = 'on_track';
        } else if (progress >= 40) {
          newStatus = 'at_risk';
        } else {
          newStatus = 'active';
        }

        // Update goal
        const { error: updateError } = await supabase
          .from('goals')
          .update({
            current_value: Math.round(newValue * 100) / 100, // Round to 2 decimal places
            status: newStatus,
            last_calculated_at: new Date().toISOString()
          })
          .eq('id', goal.id);

        if (updateError) throw updateError;

        updated++;
        results.push({
          goal_id: goal.id,
          metric_type: metricType,
          previous_value: null, // Could fetch this but not necessary
          new_value: newValue,
          progress: Math.round(progress * 100) / 100,
          status: newStatus
        });

        console.log(`[recalculate-goals] Updated goal ${goal.id}: ${newValue} (${progress.toFixed(1)}%)`);
      } catch (error) {
        failed++;
        console.error(`[recalculate-goals] Error processing goal ${goal.id}:`, error);
        results.push({
          goal_id: goal.id,
          error: String(error)
        });
      }
    }

    const result = {
      success: true,
      goals_processed: goals?.length || 0,
      updated,
      failed,
      results
    };

    console.log(`[recalculate-goals] Completed: ${updated} updated, ${failed} failed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[recalculate-goals] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
