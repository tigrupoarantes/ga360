// @ts-nocheck

export interface AIProviderConfig {
  enabled: boolean;
  api_key: string;
  default_model: string;
  goal_provider?: "openai" | "gemini";
  gemini_api_key?: string;
  gemini_model?: string;
}

export interface OpenAIApiErrorPayload {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

export type AgentErrorCode =
  | "AUTH_INVALID"
  | "INPUT_INVALID"
  | "PERMISSION_DENIED"
  | "TENANT_ACCESS_DENIED"
  | "CONFIG_MISSING"
  | "PROVIDER_AUTH"
  | "PROVIDER_QUOTA"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_MODEL_NOT_FOUND"
  | "PROVIDER_REQUEST_FAILED"
  | "INTERNAL_ERROR";

export class AgentError extends Error {
  code: AgentErrorCode;
  status: number;

  constructor(code: AgentErrorCode, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type AgentRole = "user" | "assistant" | "tool";

export type ToolName =
  | "create_goal"
  | "create_goal_activity"
  | "update_goal"
  | "update_goal_progress"
  | "deactivate_goal"
  | "complete_goal_activity"
  | "query_goals";

export interface RequestBody {
  companyId: string;
  message: string;
}

export interface ModulePermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface ProviderRuntimeConfig {
  provider: "openai" | "gemini";
  apiKey: string;
  model: string;
  endpoint: string;
}

export const SYSTEM_PROMPT = `Você é o Agente de Metas do GA 360.

Regras obrigatórias:
1) Sempre operar somente dentro da company_id autorizada para este usuário.
2) Quando precisar criar/editar/consultar dados, use as tools disponíveis.
3) Nunca invente IDs. Consulte antes, quando necessário.
4) Responda em português brasileiro de forma objetiva.
5) Quando realizar alterações, descreva claramente o que foi feito.
6) Se faltar dado essencial, faça uma pergunta de esclarecimento curta.
`;

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "create_goal",
      description: "Cria uma nova meta no portal de metas",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: ["numeric", "activity", "hybrid"] },
          pillar: { type: ["string", "null"], enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG", null] },
          unit: { type: ["string", "null"] },
          target_value: { type: ["number", "null"] },
          current_value: { type: "number" },
          cadence: { type: "string", enum: ["monthly", "activity", "quarterly", "annual"] },
          start_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          end_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          area_id: { type: ["string", "null"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal_activity",
      description: "Cria atividade vinculada a uma meta",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          weight: { type: "number" },
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
        },
        required: ["goal_id", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_goal",
      description: "Atualiza campos de uma meta existente",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "completed", "paused", "cancelled"] },
          target_value: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          end_date: { type: ["string", "null"] },
          area_id: { type: ["string", "null"] },
          cadence: { type: "string", enum: ["monthly", "activity", "quarterly", "annual"] },
          pillar: { type: ["string", "null"], enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG", null] },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_goal_progress",
      description: "Atualiza o progresso numérico da meta (current_value)",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          current_value: { type: "number" },
        },
        required: ["goal_id", "current_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deactivate_goal",
      description: "Desativa uma meta alterando status para cancelled",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_goal_activity",
      description: "Marca uma atividade como concluída",
      parameters: {
        type: "object",
        properties: {
          activity_id: { type: "string" },
        },
        required: ["activity_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_goals",
      description: "Consulta metas da empresa com filtros opcionais",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          status: { type: "string", enum: ["active", "completed", "paused", "cancelled"] },
          limit: { type: "number" },
        },
      },
    },
  },
];
