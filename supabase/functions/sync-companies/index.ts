import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface CompanyRecord {
  cnpj: string;
  nome: string;
  razao_social?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  active?: boolean;
}

interface SyncRequest {
  companies: CompanyRecord[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  console.log(`[sync-companies] Starting sync at ${startTime.toISOString()}`);

  try {
    // Validar API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[sync-companies] Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    console.log(`[sync-companies] Received ${body.companies?.length || 0} companies`);

    if (!body.companies || !Array.isArray(body.companies)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Required: companies[]' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let created = 0, updated = 0, failed = 0;
    const errors: any[] = [];

    for (const company of body.companies) {
      try {
        // Normalizar CNPJ (remover formatação)
        const normalizedCnpj = company.cnpj?.replace(/\D/g, '');
        
        if (!normalizedCnpj || normalizedCnpj.length !== 14) {
          throw new Error(`Invalid CNPJ: ${company.cnpj}`);
        }

        if (!company.nome) {
          throw new Error('Missing required field: nome');
        }

        // Buscar empresa existente pelo external_id (CNPJ)
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('external_id', normalizedCnpj)
          .maybeSingle();

        const companyData = {
          name: company.nome,
          external_id: normalizedCnpj,
          cnpj: normalizedCnpj,
          razao_social: company.razao_social || null,
          address: company.endereco || null,
          phone: company.telefone || null,
          email: company.email || null,
          is_active: company.active !== false,
          updated_at: new Date().toISOString()
        };

        if (existingCompany) {
          // UPDATE
          const { error: updateError } = await supabase
            .from('companies')
            .update(companyData)
            .eq('id', existingCompany.id);

          if (updateError) throw updateError;
          updated++;
          console.log(`[sync-companies] Updated: ${company.nome} (${normalizedCnpj})`);
        } else {
          // INSERT
          const { error: insertError } = await supabase
            .from('companies')
            .insert(companyData);

          if (insertError) throw insertError;
          created++;
          console.log(`[sync-companies] Created: ${company.nome} (${normalizedCnpj})`);
        }
      } catch (error) {
        failed++;
        errors.push({ cnpj: company.cnpj, nome: company.nome, error: String(error) });
        console.error(`[sync-companies] Error processing ${company.nome}:`, error);
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    console.log(`[sync-companies] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created, 
        updated, 
        failed,
        duration_ms: duration,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-companies] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
