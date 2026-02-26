import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { apiKey, provider = "openai" } = await req.json();
    const selectedProvider = provider === "gemini" ? "gemini" : "openai";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API Key é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let response: Response;

    if (selectedProvider === "gemini") {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
        method: "GET",
      });
    } else {
      response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Erro HTTP ${response.status}`;
      
      console.error("IA provider error:", { provider: selectedProvider, status: response.status, errorMessage });
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ success: false, error: "API Key inválida ou expirada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: "Acesso negado pela API (verifique projeto/permissões)" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const modelCount = selectedProvider === "gemini"
      ? (data.models?.length || 0)
      : (data.data?.length || 0);

    console.log(`IA connection test successful for ${selectedProvider}. Found ${modelCount} models.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: selectedProvider,
        message: "Conexão estabelecida com sucesso",
        modelsAvailable: modelCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error testing OpenAI connection:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
