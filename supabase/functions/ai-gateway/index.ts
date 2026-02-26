// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AgentError, RequestBody } from "../goal-assistant/config.ts";
import { runMetasAgent } from "../goal-assistant/core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIGatewayRequest extends RequestBody {
  module?: "metas";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado", code: "AUTH_INVALID" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido", code: "AUTH_INVALID" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = (await req.json()) as AIGatewayRequest;

    if (!body.companyId || !body.message?.trim()) {
      return new Response(JSON.stringify({ error: "companyId e message são obrigatórios", code: "INPUT_INVALID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetModule = body.module || "metas";

    if (targetModule === "metas") {
      const result = await runMetasAgent(supabaseAdmin, userId, body);
      return new Response(JSON.stringify(result.payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: result.status,
      });
    }

    return new Response(JSON.stringify({ error: "Módulo de IA não suportado no gateway", code: "INPUT_INVALID" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error: any) {
    console.error("Erro em ai-gateway:", {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });

    const mappedError =
      error instanceof AgentError
        ? error
        : new AgentError("INTERNAL_ERROR", error?.message || "Erro interno", 500);

    return new Response(JSON.stringify({ error: mappedError.message, code: mappedError.code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: mappedError.status,
    });
  }
});
