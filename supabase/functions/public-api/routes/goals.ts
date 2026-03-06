// routes/goals.ts — CRUD Metas + progresso
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ApiKeyContext } from "../_auth.ts";
import {
  ok, created, paginated, notFound, forbidden, serverError, err,
  encodeCursor, decodeCursor, getQueryParam, getLimit,
} from "../_response.ts";
import { dispatchWebhooks } from "../_webhooks.ts";

function supabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Extrai :id de paths como /goals/uuid ou /goals/uuid/progress
function extractId(path: string, base: string): string | null {
  const match = path.match(new RegExp(`^${base}/([^/]+)`));
  return match?.[1] ?? null;
}

export async function handleGoals(
  req: Request, path: string, ctx: ApiKeyContext,
): Promise<Response> {
  const url = new URL(req.url);
  const db = supabase();

  // POST /goals/:id/progress
  const progressMatch = path.match(/^\/goals\/([^/]+)\/progress$/);
  if (progressMatch && req.method === "POST") {
    if (!ctx.permissions.includes("goals:write")) return forbidden();
    return addProgress(req, progressMatch[1], ctx, db);
  }

  // /goals/:id
  const idMatch = path.match(/^\/goals\/([^/]+)$/);
  if (idMatch) {
    const id = idMatch[1];
    if (req.method === "GET") return getGoal(id, ctx, db);
    if (req.method === "PATCH") {
      if (!ctx.permissions.includes("goals:write")) return forbidden();
      return updateGoal(req, id, ctx, db);
    }
    return err("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  // /goals
  if (path === "/goals") {
    if (req.method === "GET") {
      if (!ctx.permissions.includes("goals:read")) return forbidden();
      return listGoals(url, ctx, db);
    }
    if (req.method === "POST") {
      if (!ctx.permissions.includes("goals:write")) return forbidden();
      return createGoal(req, ctx, db);
    }
  }

  return notFound("Goals route");
}

async function listGoals(url: URL, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  const limit = getLimit(url);
  const cursor = getQueryParam(url, "cursor");
  const status = getQueryParam(url, "status");
  const pillar = getQueryParam(url, "pillar");
  const cadence = getQueryParam(url, "cadence");
  const areaId = getQueryParam(url, "area_id");
  const responsibleId = getQueryParam(url, "responsible_id");

  let query = db
    .from("goals")
    .select(`
      id, title, pillar, unit, target_value, current_value,
      status, cadence, area_id, responsible_id, company_id,
      distributor_id, metric_type, auto_calculate,
      created_at, updated_at
    `)
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq("status", status);
  if (pillar) query = query.eq("pillar", pillar);
  if (cadence) query = query.eq("cadence", cadence);
  if (areaId) query = query.eq("area_id", areaId);
  if (responsibleId) query = query.eq("responsible_id", responsibleId);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) query = query.lt("created_at", decoded.created_at);
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const hasMore = data.length > limit;
  const rows = hasMore ? data.slice(0, limit) : data;
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.id, last.created_at) : null;

  return paginated(rows, nextCursor);
}

async function getGoal(id: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  const { data, error } = await db
    .from("goals")
    .select(`
      id, title, pillar, unit, target_value, current_value,
      status, cadence, area_id, responsible_id, company_id, created_at, updated_at,
      goal_updates(id, value, notes, created_at, updated_by),
      goal_activities(id, title, status, weight, due_date, responsible_id)
    `)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound("Goal");
  return ok(data);
}

async function createGoal(req: Request, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON", "INVALID_JSON"); }

  const { title, pillar, unit, target_value, cadence, area_id, responsible_id } = body as any;
  if (!title || !pillar || !unit || target_value === undefined || !cadence) {
    return err("Campos obrigatórios: title, pillar, unit, target_value, cadence", "MISSING_FIELDS");
  }

  const { data, error } = await db.from("goals").insert({
    title, pillar, unit, target_value, cadence,
    area_id: area_id ?? null,
    responsible_id: responsible_id ?? null,
    company_id: ctx.companyId,
    status: "on_track",
    current_value: 0,
  }).select().maybeSingle();

  if (error) return serverError(error.message);

  dispatchWebhooks(ctx.companyId, "goal.created", data);
  return created(data);
}

async function updateGoal(req: Request, id: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON", "INVALID_JSON"); }

  const allowed = ["title", "pillar", "unit", "target_value", "cadence", "status", "area_id", "responsible_id"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (!Object.keys(patch).length) return err("Nenhum campo para atualizar", "NO_FIELDS");

  const { data, error } = await db
    .from("goals")
    .update(patch)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound("Goal");

  dispatchWebhooks(ctx.companyId, "goal.updated", data);
  return ok(data);
}

async function addProgress(req: Request, id: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON", "INVALID_JSON"); }

  const { value, notes } = body as any;
  if (value === undefined || typeof value !== "number") {
    return err("Campo obrigatório: value (número)", "MISSING_FIELDS");
  }

  // Verifica que a meta pertence à company
  const { data: goal } = await db.from("goals").select("id").eq("id", id).eq("company_id", ctx.companyId).maybeSingle();
  if (!goal) return notFound("Goal");

  const { data: update, error } = await db.from("goal_updates").insert({
    goal_id: id,
    value,
    notes: notes ?? null,
  }).select().maybeSingle();

  if (error) return serverError(error.message);

  // Atualiza current_value na meta
  await db.from("goals").update({ current_value: value }).eq("id", id);

  dispatchWebhooks(ctx.companyId, "goal.progress_added", { goal_id: id, ...update });
  return created(update);
}
