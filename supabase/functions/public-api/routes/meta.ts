// routes/meta.ts — GET /me e GET /openapi.json
import type { ApiKeyContext } from "../_auth.ts";
import { ok } from "../_response.ts";

export function handleMeta(path: string, ctx: ApiKeyContext): Response {
  if (path === "/me") {
    return ok({
      company_id: ctx.companyId,
      company_name: ctx.companyName,
      api_key_prefix: ctx.keyPrefix,
      permissions: ctx.permissions,
    });
  }

  if (path === "/openapi.json") {
    return openApiSpec(ctx);
  }

  return new Response(JSON.stringify({ error: "Not found", code: "NOT_FOUND" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

function openApiSpec(_ctx: ApiKeyContext): Response {
  const baseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/public-api/v1`;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "GA360 Public API",
      version: "1.0.0",
      description:
        "API pública do GA360 para integrações com n8n, Make, MCP e outros sistemas.\n\n" +
        "**Autenticação:** Todas as rotas exigem o header `X-Api-Key` com uma chave válida.\n\n" +
        "Gerencie suas chaves em **Admin → API & Integrações**.",
      contact: { name: "GA360 Suporte", email: "suporte@ga360.com.br" },
    },
    servers: [{ url: baseUrl, description: "Produção" }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-Api-Key",
          description: "Chave no formato `ga360_<random>`. Gerada em Admin → API & Integrações.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error", "code"],
          properties: {
            error: { type: "string", example: "Resource not found" },
            code: { type: "string", example: "NOT_FOUND" },
          },
        },
        Goal: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Crescer receita 20% no trimestre" },
            pillar: { type: "string", enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG"] },
            unit: { type: "string", example: "%" },
            target_value: { type: "number", example: 20 },
            current_value: { type: "number", example: 15.5 },
            status: { type: "string", enum: ["on_track", "at_risk", "behind", "completed"] },
            cadence: { type: "string", enum: ["mensal", "trimestral", "anual"] },
            area_id: { type: "string", format: "uuid", nullable: true },
            responsible_id: { type: "string", format: "uuid", nullable: true },
            company_id: { type: "string", format: "uuid" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        Meeting: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Reunião de Resultados Q1" },
            type: { type: "string", enum: ["Estratégica", "Tática", "Operacional", "Trade"] },
            status: { type: "string", example: "agendada" },
            scheduled_at: { type: "string", format: "date-time" },
            duration_minutes: { type: "integer", example: 60 },
            area_id: { type: "string", format: "uuid", nullable: true },
            meeting_room_id: { type: "string", format: "uuid", nullable: true },
            company_id: { type: "string", format: "uuid" },
            created_by: { type: "string", format: "uuid" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Company: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            cnpj: { type: "string", nullable: true },
            is_active: { type: "boolean" },
          },
        },
        KpiSummary: {
          type: "object",
          properties: {
            sales_mtd: { type: "number" },
            sales_wtd: { type: "number" },
            sales_dtd: { type: "number" },
            positivation_pct: { type: "number" },
            coverage_pct: { type: "number" },
            order_count: { type: "integer" },
            avg_ticket: { type: "number" },
            variation_mtd_pct: { type: "number", nullable: true },
          },
        },
        WebhookSubscription: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            url: { type: "string", format: "uri" },
            events: { type: "array", items: { type: "string" } },
            is_active: { type: "boolean" },
            last_called_at: { type: "string", format: "date-time", nullable: true },
            last_status: { type: "integer", nullable: true },
            failure_count: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/me": {
        get: {
          tags: ["Meta"],
          summary: "Identidade da API Key",
          operationId: "getMe",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          company_id: { type: "string", format: "uuid" },
                          company_name: { type: "string" },
                          api_key_prefix: { type: "string" },
                          permissions: { type: "array", items: { type: "string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Não autorizado" },
          },
        },
      },
      "/goals": {
        get: {
          tags: ["Metas"],
          summary: "Listar metas",
          operationId: "listGoals",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["on_track", "at_risk", "behind", "completed"] } },
            { name: "pillar", in: "query", schema: { type: "string", enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG"] } },
            { name: "cadence", in: "query", schema: { type: "string", enum: ["mensal", "trimestral", "anual"] } },
            { name: "area_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "responsible_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 250, default: 50 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Lista paginada de metas",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { type: "array", items: { $ref: "#/components/schemas/Goal" } },
                      nextCursor: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Metas"],
          summary: "Criar meta",
          operationId: "createGoal",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "pillar", "unit", "target_value", "cadence"],
                  properties: {
                    title: { type: "string" },
                    pillar: { type: "string", enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG"] },
                    unit: { type: "string", example: "%" },
                    target_value: { type: "number" },
                    cadence: { type: "string", enum: ["mensal", "trimestral", "anual"] },
                    area_id: { type: "string", format: "uuid" },
                    responsible_id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Meta criada" },
            "400": { description: "Dados inválidos" },
          },
        },
      },
      "/goals/{id}": {
        get: {
          tags: ["Metas"],
          summary: "Detalhe de uma meta",
          operationId: "getGoal",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "OK" }, "404": { description: "Não encontrada" } },
        },
        patch: {
          tags: ["Metas"],
          summary: "Atualizar meta",
          operationId: "updateGoal",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    target_value: { type: "number" },
                    status: { type: "string" },
                    responsible_id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" }, "404": { description: "Não encontrada" } },
        },
      },
      "/goals/{id}/progress": {
        post: {
          tags: ["Metas"],
          summary: "Registrar progresso",
          operationId: "addGoalProgress",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["value"],
                  properties: {
                    value: { type: "number", example: 75.5 },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Progresso registrado" } },
        },
      },
      "/meetings": {
        get: {
          tags: ["Reuniões"],
          summary: "Listar reuniões",
          operationId: "listMeetings",
          parameters: [
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "area_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "scheduled_after", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "scheduled_before", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 250, default: 50 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Reuniões"],
          summary: "Criar reunião",
          operationId: "createMeeting",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "type", "scheduled_at", "duration_minutes"],
                  properties: {
                    title: { type: "string" },
                    type: { type: "string", enum: ["Estratégica", "Tática", "Operacional", "Trade"] },
                    scheduled_at: { type: "string", format: "date-time" },
                    duration_minutes: { type: "integer", default: 60 },
                    area_id: { type: "string", format: "uuid" },
                    meeting_room_id: { type: "string", format: "uuid" },
                    participant_ids: { type: "array", items: { type: "string", format: "uuid" } },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Reunião criada" } },
        },
      },
      "/meetings/{id}": {
        get: {
          tags: ["Reuniões"],
          summary: "Detalhe de una reunião",
          operationId: "getMeeting",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "OK" }, "404": { description: "Não encontrada" } },
        },
        patch: {
          tags: ["Reuniões"],
          summary: "Atualizar reunião",
          operationId: "updateMeeting",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    scheduled_at: { type: "string", format: "date-time" },
                    duration_minutes: { type: "integer" },
                    status: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
      },
      "/meetings/{id}/participants": {
        post: {
          tags: ["Reuniões"],
          summary: "Adicionar participante",
          operationId: "addParticipant",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["user_id"],
                  properties: { user_id: { type: "string", format: "uuid" } },
                },
              },
            },
          },
          responses: { "201": { description: "Participante adicionado" } },
        },
      },
      "/companies": {
        get: {
          tags: ["Empresas"],
          summary: "Listar empresas",
          operationId: "listCompanies",
          responses: { "200": { description: "OK" } },
        },
      },
      "/kpis/summary": {
        get: {
          tags: ["Comercial / KPIs"],
          summary: "Resumo de KPIs comerciais",
          operationId: "getKpiSummary",
          parameters: [
            { name: "start_date", in: "query", required: true, schema: { type: "string", format: "date", example: "2026-01-01" } },
            { name: "end_date", in: "query", required: true, schema: { type: "string", format: "date", example: "2026-01-31" } },
            { name: "channel_code", in: "query", schema: { type: "string" } },
            { name: "bu_id", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { data: { $ref: "#/components/schemas/KpiSummary" } },
                  },
                },
              },
            },
          },
        },
      },
      "/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "Listar webhooks registrados",
          operationId: "listWebhooks",
          responses: { "200": { description: "OK" } },
        },
        post: {
          tags: ["Webhooks"],
          summary: "Registrar webhook",
          operationId: "createWebhook",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "events"],
                  properties: {
                    name: { type: "string", example: "n8n Workflow" },
                    url: { type: "string", format: "uri", example: "https://n8n.empresa.com/webhook/abc" },
                    events: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: [
                          "goal.created", "goal.updated", "goal.progress_added",
                          "meeting.created", "meeting.updated", "meeting.status_changed",
                        ],
                      },
                      example: ["goal.updated", "meeting.created"],
                    },
                    secret: { type: "string", description: "Gerado automaticamente se omitido" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Webhook registrado. Guarde o `secret` — não será exibido novamente.",
            },
          },
        },
      },
      "/webhooks/{id}": {
        delete: {
          tags: ["Webhooks"],
          summary: "Remover webhook",
          operationId: "deleteWebhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "204": { description: "Removido" } },
        },
      },
      "/webhooks/{id}/test": {
        post: {
          tags: ["Webhooks"],
          summary: "Enviar payload de teste",
          operationId: "testWebhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Payload enviado" } },
        },
      },
    },
  };

  return new Response(JSON.stringify(spec, null, 2), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
