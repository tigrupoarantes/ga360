// @ts-nocheck

import {
  AIProviderConfig,
  AgentError,
  OpenAIApiErrorPayload,
  ProviderRuntimeConfig,
  TOOL_DEFINITIONS,
} from "./config.ts";

function buildProviderConfig(provider: "openai" | "gemini", aiConfig: AIProviderConfig | null): ProviderRuntimeConfig | null {
  if (provider === "openai") {
    const apiKey = aiConfig?.api_key || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return null;
    return {
      provider: "openai",
      apiKey,
      model: aiConfig?.default_model || "gpt-4o-mini",
      endpoint: "https://api.openai.com/v1/chat/completions",
    };
  }

  const geminiKey = aiConfig?.gemini_api_key || Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return null;
  return {
    provider: "gemini",
    apiKey: geminiKey,
    model: aiConfig?.gemini_model || "gemini-2.0-flash-lite",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  };
}

export async function getAIProviderConfig(
  supabaseAdmin: any
): Promise<{ primary: ProviderRuntimeConfig; fallback: ProviderRuntimeConfig | null }> {
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "openai_config")
    .single();

  const aiConfig = settings?.value as AIProviderConfig | null;
  const hasOpenAIKey = Boolean(aiConfig?.api_key) || Boolean(Deno.env.get("OPENAI_API_KEY"));
  const hasGeminiKey = Boolean(aiConfig?.gemini_api_key) || Boolean(Deno.env.get("GEMINI_API_KEY"));

  const selectedProvider =
    aiConfig?.goal_provider === "gemini"
      ? "gemini"
      : aiConfig?.goal_provider === "openai"
      ? "openai"
      : hasGeminiKey && !hasOpenAIKey
      ? "gemini"
      : "openai";

  const primary = buildProviderConfig(selectedProvider, aiConfig);
  const secondaryProvider = selectedProvider === "openai" ? "gemini" : "openai";
  const fallback = buildProviderConfig(secondaryProvider, aiConfig);

  if (!primary && !fallback) {
    throw new AgentError("CONFIG_MISSING", "Nenhum provedor de IA configurado (OpenAI/Gemini).", 500);
  }

  if (!primary && fallback) {
    return { primary: fallback, fallback: null };
  }

  return { primary: primary as ProviderRuntimeConfig, fallback };
}

function buildModelCandidates(provider: "openai" | "gemini", configuredModel: string) {
  const normalizedConfigured = String(configuredModel || "gpt-4o").trim();
  const candidates =
    provider === "gemini"
      ? [normalizedConfigured, "gemini-2.0-flash-lite", "gemini-2.0-flash"]
      : [normalizedConfigured, "gpt-4o-mini", "gpt-4o"];

  return [...new Set(candidates)];
}

function mapProviderFailure(params: {
  provider: "openai" | "gemini";
  status: number;
  message: string;
  apiCode?: string;
  model: string;
}): AgentError {
  const providerName = params.provider === "gemini" ? "Gemini" : "OpenAI";
  const lowerMessage = params.message.toLowerCase();

  if (params.status === 401 || params.status === 403) {
    return new AgentError(
      "PROVIDER_AUTH",
      `${providerName} rejeitou a autenticação. Verifique a API key configurada.`,
      502
    );
  }

  if (params.status === 429) {
    const code = lowerMessage.includes("quota") ? "PROVIDER_QUOTA" : "PROVIDER_RATE_LIMIT";
    const message =
      code === "PROVIDER_QUOTA"
        ? `${providerName} sem créditos/cota disponível no momento.`
        : `${providerName} com limite de requisições no momento. Tente novamente em instantes.`;
    return new AgentError(code, message, 429);
  }

  if (
    params.status === 400 ||
    params.status === 404 ||
    params.apiCode === "model_not_found" ||
    lowerMessage.includes("model")
  ) {
    return new AgentError(
      "PROVIDER_MODEL_NOT_FOUND",
      `${providerName} não encontrou modelo compatível (${params.model}).`,
      502
    );
  }

  if (params.status >= 500) {
    return new AgentError(
      "PROVIDER_UNAVAILABLE",
      `${providerName} indisponível no momento. Tente novamente em instantes.`,
      503
    );
  }

  return new AgentError(
    "PROVIDER_REQUEST_FAILED",
    `${providerName} falhou ao processar a solicitação: ${params.message}`,
    502
  );
}

async function createChatCompletionWithFallback(params: ProviderRuntimeConfig & { messages: any[]; tools?: unknown[] }) {
  const modelCandidates = buildModelCandidates(params.provider, params.model);
  let lastError: AgentError | null = null;

  for (const candidateModel of modelCandidates) {
    const response = await fetch(params.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: candidateModel,
        messages: params.messages,
        tools: params.tools || TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });

    if (response.ok) {
      return { completion: await response.json(), usedProvider: params.provider, usedModel: candidateModel };
    }

    const errorBodyText = await response.text();
    let parsedError: OpenAIApiErrorPayload | null = null;
    try {
      parsedError = JSON.parse(errorBodyText) as OpenAIApiErrorPayload;
    } catch {
      parsedError = null;
    }

    const apiMessage = parsedError?.error?.message || errorBodyText || `HTTP ${response.status}`;
    const mappedError = mapProviderFailure({
      provider: params.provider,
      status: response.status,
      message: apiMessage,
      apiCode: parsedError?.error?.code,
      model: candidateModel,
    });
    lastError = mappedError;

    const isRetryableModelError = mappedError.code === "PROVIDER_MODEL_NOT_FOUND";

    if (isRetryableModelError && candidateModel !== modelCandidates[modelCandidates.length - 1]) {
      console.warn("Fallback de modelo IA acionado", {
        provider: params.provider,
        attempted_model: candidateModel,
        status: response.status,
      });
      continue;
    }

    throw mappedError;
  }

  throw lastError || new AgentError("PROVIDER_REQUEST_FAILED", "Falha ao consultar provedor de IA", 502);
}

function shouldAttemptProviderFallback(error: unknown) {
  if (!(error instanceof AgentError)) return false;
  return ["PROVIDER_QUOTA", "PROVIDER_RATE_LIMIT", "PROVIDER_UNAVAILABLE"].includes(error.code);
}

export async function createChatCompletionWithProviderFallback(params: {
  primary: ProviderRuntimeConfig;
  fallback: ProviderRuntimeConfig | null;
  messages: any[];
  tools?: unknown[];
}) {
  try {
    return await createChatCompletionWithFallback({
      ...params.primary,
      messages: params.messages,
      tools: params.tools,
    });
  } catch (primaryError) {
    if (!params.fallback || !shouldAttemptProviderFallback(primaryError)) {
      throw primaryError;
    }

    console.warn("Fallback entre providers acionado", {
      from: params.primary.provider,
      to: params.fallback.provider,
      reason: primaryError instanceof AgentError ? primaryError.code : "UNKNOWN",
    });

    return await createChatCompletionWithFallback({
      ...params.fallback,
      messages: params.messages,
      tools: params.tools,
    });
  }
}
