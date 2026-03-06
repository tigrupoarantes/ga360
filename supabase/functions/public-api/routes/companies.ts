// routes/companies.ts — GET /companies
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ApiKeyContext } from "../_auth.ts";
import { ok, forbidden, serverError } from "../_response.ts";

export async function handleCompanies(
  _req: Request, path: string, ctx: ApiKeyContext,
): Promise<Response> {
  if (path !== "/companies") return ok([]);
  if (!ctx.permissions.includes("companies:read")) return forbidden();

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // A API key já está limitada a uma empresa — retorna apenas essa empresa
  const { data, error } = await db
    .from("companies")
    .select("id, name, cnpj, is_active, logo_url")
    .eq("id", ctx.companyId);

  if (error) return serverError(error.message);
  return ok(data ?? []);
}
