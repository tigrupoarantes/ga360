import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type D4SignAction =
  | "list_safes"
  | "upload_document"
  | "add_signer"
  | "add_pins"
  | "send_to_sign"
  | "get_document"
  | "list_documents"
  | "download_document"
  | "cancel_document"
  | "register_webhook"
  | "get_balance";

interface D4SignProxyRequest {
  action: D4SignAction;
  companyId?: string;
  payload?: Record<string, unknown>;
}

interface D4SignConfig {
  token_api: string;
  crypt_key: string;
  safe_id: string | null;
  environment: string;
  base_url: string;
}

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

async function getD4SignConfig(
  supabase: ReturnType<typeof createClient>,
): Promise<D4SignConfig> {
  const { data, error } = await supabase
    .from("d4sign_config")
    .select("token_api, crypt_key, safe_id, environment, base_url")
    .is("company_id", null)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error("D4Sign global config not found. Configure as credenciais em Admin → D4Sign.");
  }

  return data as D4SignConfig;
}

function buildD4SignUrl(baseUrl: string, path: string, tokenApi: string, cryptKey: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/${path}`);
  url.searchParams.set("tokenAPI", tokenApi);
  url.searchParams.set("cryptKey", cryptKey);
  return url.toString();
}

async function callD4Sign(
  url: string,
  method: string,
  body?: unknown,
  isFileUpload = false,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  let fetchBody: BodyInit | undefined;

  if (isFileUpload && body && typeof body === "object") {
    // body deve ser um FormData para upload
    fetchBody = body as FormData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const response = await fetch(url, { method, headers, body: fetchBody });
  const text = await response.text();

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { ok: response.ok, status: response.status, data };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as D4SignProxyRequest;
    const { action, payload = {} } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role para buscar config sensível
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const config = await getD4SignConfig(supabase);
    const { token_api, crypt_key, safe_id, base_url } = config;

    let result: { ok: boolean; status: number; data: unknown };

    switch (action) {
      case "list_safes": {
        const url = buildD4SignUrl(base_url, "safes", token_api, crypt_key);
        result = await callD4Sign(url, "GET");
        break;
      }

      case "upload_document": {
        // payload: { safeUuid?, fileBase64, fileName }
        const safeUuid = (payload.safeUuid as string) || safe_id;
        if (!safeUuid) throw new Error("safeUuid or default safe_id required for upload_document");

        const fileBase64 = payload.fileBase64 as string;
        const fileName = (payload.fileName as string) || "documento.pdf";

        if (!fileBase64) throw new Error("fileBase64 required for upload_document");

        // Converter base64 para Blob
        const binaryStr = atob(fileBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });

        const formData = new FormData();
        formData.append("file", blob, fileName);
        if (payload.name) formData.append("name", String(payload.name));

        const url = buildD4SignUrl(base_url, `documents/${safeUuid}/upload`, token_api, crypt_key);
        result = await callD4Sign(url, "POST", formData, true);
        break;
      }

      case "add_signer": {
        // payload: { documentUuid, signers: [{ email, act, foreign?, foreignLang?, ... }] }
        const documentUuid = payload.documentUuid as string;
        if (!documentUuid) throw new Error("documentUuid required for add_signer");

        const url = buildD4SignUrl(base_url, `documents/${documentUuid}/createlist`, token_api, crypt_key);
        result = await callD4Sign(url, "POST", { signers: payload.signers || [] });
        break;
      }

      case "add_pins": {
        // payload: { documentUuid, pins: [{ document, email, page_height, page_width, page, position_x, position_y, type? }] }
        const documentUuid = payload.documentUuid as string;
        if (!documentUuid) throw new Error("documentUuid required for add_pins");

        const url = buildD4SignUrl(base_url, `documents/${documentUuid}/addpins`, token_api, crypt_key);
        result = await callD4Sign(url, "POST", { pins: payload.pins || [] });
        break;
      }

      case "send_to_sign": {
        // payload: { documentUuid, message?, workflow? }
        const documentUuid = payload.documentUuid as string;
        if (!documentUuid) throw new Error("documentUuid required for send_to_sign");

        const url = buildD4SignUrl(base_url, `documents/${documentUuid}/sendtosign`, token_api, crypt_key);
        result = await callD4Sign(url, "POST", {
          message: payload.message || "Por favor, assine o documento de verba indenizatória.",
          workflow: payload.workflow ?? 0,
          skip_email: payload.skip_email ?? 0,
        });
        break;
      }

      case "get_document": {
        // payload: { documentUuid }
        const documentUuid = payload.documentUuid as string;
        if (!documentUuid) throw new Error("documentUuid required for get_document");

        const url = buildD4SignUrl(base_url, `documents/${documentUuid}`, token_api, crypt_key);
        result = await callD4Sign(url, "GET");
        break;
      }

      case "list_documents": {
        // payload: { safeUuid?, pg? }
        const safeUuid = (payload.safeUuid as string) || safe_id;
        if (!safeUuid) throw new Error("safeUuid or default safe_id required for list_documents");

        const pg = payload.pg || 1;
        const url = buildD4SignUrl(base_url, `documents/${safeUuid}/list/${pg}`, token_api, crypt_key);
        result = await callD4Sign(url, "GET");
        break;
      }

      case "download_document": {
        // payload: { documentUuid, type? } — type: 0=PDF assinado, 1=arquivo original
        const documentUuid = payload.documentUuid as string;
        if (!documentUuid) throw new Error("documentUuid required for download_document");

        const url = buildD4SignUrl(base_url, `documents/${documentUuid}/download`, token_api, crypt_key);
        result = await callD4Sign(url, "POST", { type: payload.type ?? 0 });
        break;
      }

      case "cancel_document": {
        // payload: { documentUuid, comment? }
        const documentUuid = payload.documentUuid as string;
        if (!documentUuid) throw new Error("documentUuid required for cancel_document");

        const url = buildD4SignUrl(base_url, `documents/${documentUuid}/cancel`, token_api, crypt_key);
        result = await callD4Sign(url, "POST", { comment: payload.comment || "Documento cancelado pelo sistema GA360." });
        break;
      }

      case "register_webhook": {
        // payload: { documentUuid, webhookUrl }
        const documentUuid = payload.documentUuid as string;
        const webhookUrl = payload.webhookUrl as string;
        if (!documentUuid || !webhookUrl) throw new Error("documentUuid and webhookUrl required for register_webhook");

        const url = buildD4SignUrl(base_url, `documents/${documentUuid}/webhooks`, token_api, crypt_key);
        result = await callD4Sign(url, "POST", { url: webhookUrl });
        break;
      }

      case "get_balance": {
        // Retorna saldo de documentos do pacote D4Sign
        const url = buildD4SignUrl(base_url, "account/balance", token_api, crypt_key);
        result = await callD4Sign(url, "GET");
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "unknown_action", action }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(
      JSON.stringify({ ok: result.ok, status: result.status, data: result.data }),
      {
        status: result.ok ? 200 : result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
