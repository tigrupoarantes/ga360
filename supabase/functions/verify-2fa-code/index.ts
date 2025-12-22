import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Verify2FARequest {
  userId: string;
  code: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, code }: Verify2FARequest = await req.json();

    if (!userId || !code) {
      return new Response(
        JSON.stringify({ error: "userId e code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔐 Verificando código 2FA para userId: ${userId}`);

    // Buscar código válido
    const { data: codeRecord, error: fetchError } = await supabase
      .from("two_factor_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !codeRecord) {
      console.log("Código não encontrado ou expirado:", fetchError);
      return new Response(
        JSON.stringify({ error: "Código expirado ou inválido. Solicite um novo código." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar número de tentativas (máximo 5)
    if (codeRecord.attempts >= 5) {
      // Invalidar código após muitas tentativas
      await supabase
        .from("two_factor_codes")
        .delete()
        .eq("id", codeRecord.id);

      return new Response(
        JSON.stringify({ error: "Muitas tentativas incorretas. Solicite um novo código." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar código
    if (codeRecord.code !== code) {
      // Incrementar tentativas
      await supabase
        .from("two_factor_codes")
        .update({ attempts: codeRecord.attempts + 1 })
        .eq("id", codeRecord.id);

      const remainingAttempts = 4 - codeRecord.attempts;
      return new Response(
        JSON.stringify({ 
          error: `Código incorreto. ${remainingAttempts > 0 ? `${remainingAttempts} tentativas restantes.` : 'Última tentativa.'}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Código correto - marcar como verificado
    await supabase
      .from("two_factor_codes")
      .update({ verified: true })
      .eq("id", codeRecord.id);

    console.log("✅ Código 2FA verificado com sucesso");

    // Log de auditoria
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action_type: "2fa_verified",
      details: {
        method: codeRecord.method,
        verified_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Código verificado com sucesso",
        method: codeRecord.method,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro em verify-2fa-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
