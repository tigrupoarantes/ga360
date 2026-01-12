import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface EmployeeRecord {
  external_id: string;
  registration_number?: string;
  full_name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

interface SyncRequest {
  company_external_id: string;
  source_system?: string;
  employees: EmployeeRecord[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  console.log(`[sync-employees] Starting sync at ${startTime.toISOString()}`);

  try {
    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[sync-employees] Invalid or missing API key');
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
    const sourceSystem = body.source_system || 'gestao_ativos';
    console.log(`[sync-employees] Received ${body.employees?.length || 0} records from ${sourceSystem} for company: ${body.company_external_id}`);

    if (!body.company_external_id || !body.employees || !Array.isArray(body.employees)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Required: company_external_id, employees[]' }),
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
      console.error('[sync-employees] Company not found:', body.company_external_id, companyError);
      return new Response(
        JSON.stringify({ error: `Company not found: ${body.company_external_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = company.id;
    console.log(`[sync-employees] Found company ID: ${companyId}`);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        company_id: companyId,
        sync_type: 'employees',
        records_received: body.employees.length,
        status: 'running'
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('[sync-employees] Error creating sync log:', syncLogError);
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const employee of body.employees) {
      try {
        // Validate required fields
        if (!employee.external_id || !employee.full_name) {
          throw new Error('Missing required fields: external_id, full_name');
        }

        // Check if employee exists
        const { data: existingEmployee } = await supabase
          .from('external_employees')
          .select('id')
          .eq('company_id', companyId)
          .eq('external_id', employee.external_id)
          .eq('source_system', sourceSystem)
          .maybeSingle();

        const employeeData = {
          company_id: companyId,
          external_id: employee.external_id,
          source_system: sourceSystem,
          registration_number: employee.registration_number,
          full_name: employee.full_name,
          email: employee.email,
          phone: employee.phone,
          department: employee.department,
          position: employee.position,
          hire_date: employee.hire_date || null,
          is_active: employee.is_active ?? true,
          metadata: employee.metadata || null,
          synced_at: new Date().toISOString()
        };

        if (existingEmployee) {
          // Update existing employee
          const { error: updateError } = await supabase
            .from('external_employees')
            .update({
              ...employeeData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingEmployee.id);

          if (updateError) throw updateError;
          updated++;
          console.log(`[sync-employees] Updated employee: ${employee.external_id}`);
        } else {
          // Insert new employee
          const { error: insertError } = await supabase
            .from('external_employees')
            .insert(employeeData);

          if (insertError) throw insertError;
          created++;
          console.log(`[sync-employees] Created employee: ${employee.external_id}`);
        }
      } catch (error) {
        failed++;
        errors.push({ external_id: employee.external_id, error: String(error) });
        console.error(`[sync-employees] Error processing employee ${employee.external_id}:`, error);
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
          status: failed > 0 ? (created + updated > 0 ? 'partial' : 'failed') : 'success'
        })
        .eq('id', syncLog.id);
    }

    const result = {
      success: true,
      source_system: sourceSystem,
      records_received: body.employees.length,
      created,
      updated,
      failed,
      duration_ms: durationMs,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`[sync-employees] Completed: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-employees] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
