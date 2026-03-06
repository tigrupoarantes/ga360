// routes/meetings.ts — CRUD Reuniões + participantes
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

export async function handleMeetings(
  req: Request, path: string, ctx: ApiKeyContext,
): Promise<Response> {
  const url = new URL(req.url);
  const db = supabase();

  // POST /meetings/:id/participants
  const participantsMatch = path.match(/^\/meetings\/([^/]+)\/participants$/);
  if (participantsMatch && req.method === "POST") {
    if (!ctx.permissions.includes("meetings:write")) return forbidden();
    return addParticipant(req, participantsMatch[1], ctx, db);
  }

  // /meetings/:id
  const idMatch = path.match(/^\/meetings\/([^/]+)$/);
  if (idMatch) {
    const id = idMatch[1];
    if (req.method === "GET") {
      if (!ctx.permissions.includes("meetings:read")) return forbidden();
      return getMeeting(id, ctx, db);
    }
    if (req.method === "PATCH") {
      if (!ctx.permissions.includes("meetings:write")) return forbidden();
      return updateMeeting(req, id, ctx, db);
    }
    return err("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  // /meetings
  if (path === "/meetings") {
    if (req.method === "GET") {
      if (!ctx.permissions.includes("meetings:read")) return forbidden();
      return listMeetings(url, ctx, db);
    }
    if (req.method === "POST") {
      if (!ctx.permissions.includes("meetings:write")) return forbidden();
      return createMeeting(req, ctx, db);
    }
  }

  return notFound("Meetings route");
}

async function listMeetings(url: URL, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  const limit = getLimit(url);
  const cursor = getQueryParam(url, "cursor");
  const status = getQueryParam(url, "status");
  const areaId = getQueryParam(url, "area_id");
  const after = getQueryParam(url, "scheduled_after");
  const before = getQueryParam(url, "scheduled_before");

  let query = db
    .from("meetings")
    .select(`
      id, title, type, status, scheduled_at, duration_minutes,
      area_id, meeting_room_id, company_id, created_by, created_at,
      ai_mode
    `)
    .eq("company_id", ctx.companyId)
    .order("scheduled_at", { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq("status", status);
  if (areaId) query = query.eq("area_id", areaId);
  if (after) query = query.gte("scheduled_at", after);
  if (before) query = query.lte("scheduled_at", before);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) query = query.lt("scheduled_at", decoded.created_at);
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const hasMore = data.length > limit;
  const rows = hasMore ? data.slice(0, limit) : data;
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor(last.id, last.scheduled_at ?? last.created_at)
    : null;

  return paginated(rows, nextCursor);
}

async function getMeeting(id: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  const { data, error } = await db
    .from("meetings")
    .select(`
      id, title, type, status, scheduled_at, duration_minutes,
      area_id, meeting_room_id, company_id, created_by, created_at, ai_mode,
      meeting_participants(id, user_id, attended, confirmation_status),
      meeting_atas(id, summary, decisions, action_items, status),
      meeting_tasks(id, title, status, assignee_id, due_date, priority)
    `)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound("Meeting");
  return ok(data);
}

async function createMeeting(req: Request, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON", "INVALID_JSON"); }

  const { title, type, scheduled_at, duration_minutes, area_id, meeting_room_id, participant_ids } = body as any;
  if (!title || !type || !scheduled_at || !duration_minutes) {
    return err("Campos obrigatórios: title, type, scheduled_at, duration_minutes", "MISSING_FIELDS");
  }

  const validTypes = ["Estratégica", "Tática", "Operacional", "Trade"];
  if (!validTypes.includes(type)) {
    return err(`Tipo inválido. Use: ${validTypes.join(", ")}`, "INVALID_TYPE");
  }

  const { data: meeting, error } = await db.from("meetings").insert({
    title, type, scheduled_at, duration_minutes,
    area_id: area_id ?? null,
    meeting_room_id: meeting_room_id ?? null,
    company_id: ctx.companyId,
    status: "agendada",
  }).select().maybeSingle();

  if (error) return serverError(error.message);

  // Adicionar participantes se informados
  if (Array.isArray(participant_ids) && participant_ids.length > 0) {
    await db.from("meeting_participants").insert(
      participant_ids.map((uid: string) => ({ meeting_id: meeting.id, user_id: uid })),
    );
  }

  dispatchWebhooks(ctx.companyId, "meeting.created", meeting);
  return created(meeting);
}

async function updateMeeting(req: Request, id: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON", "INVALID_JSON"); }

  const allowed = ["title", "type", "scheduled_at", "duration_minutes", "status", "meeting_room_id", "area_id"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (!Object.keys(patch).length) return err("Nenhum campo para atualizar", "NO_FIELDS");

  const { data, error } = await db
    .from("meetings")
    .update(patch)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound("Meeting");

  const event = patch.status ? "meeting.status_changed" : "meeting.updated";
  dispatchWebhooks(ctx.companyId, event as any, data);
  return ok(data);
}

async function addParticipant(req: Request, meetingId: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON", "INVALID_JSON"); }

  const { user_id } = body as any;
  if (!user_id) return err("Campo obrigatório: user_id", "MISSING_FIELDS");

  // Verifica tenure
  const { data: meeting } = await db.from("meetings").select("id").eq("id", meetingId).eq("company_id", ctx.companyId).maybeSingle();
  if (!meeting) return notFound("Meeting");

  const { data, error } = await db.from("meeting_participants").insert({
    meeting_id: meetingId,
    user_id,
  }).select().maybeSingle();

  if (error) return serverError(error.message);
  return created(data);
}
