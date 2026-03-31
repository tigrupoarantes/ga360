// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AgentError, RequestBody } from "./config.ts";
import { runMetasAgent } from "./core.ts";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado", code: "AUTH_INVALID" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = (await req.json()) as RequestBody;

    if (!body.companyId || !body.message?.trim()) {
      return new Response(JSON.stringify({ error: "companyId e message são obrigatórios", code: "INPUT_INVALID" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await runMetasAgent(supabaseAdmin, userId, body);
    return new Response(JSON.stringify(result.payload), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: result.status,
    });
  } catch (error: any) {
    console.error("Erro em goal-assistant:", {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });

    const mappedError =
      error instanceof AgentError
        ? error
        : new AgentError("INTERNAL_ERROR", error?.message || "Erro interno", 500);

    return new Response(JSON.stringify({ error: mappedError.message, code: mappedError.code }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: mappedError.status,
    });
  }
});
