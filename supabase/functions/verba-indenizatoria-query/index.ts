import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

interface QueryRequest {
  companyId: string;
  fetchEmployeesWithVerba?: boolean;
  fetchAccountingGroups?: boolean;
  accountingGroups?: string[];
  competencia?: string;
  cpf?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  documentId?: string;
  fetchLogs?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userData: { user: { id: string; email?: string } | null } | null = null;
    let userError: { message: string } | null = null;
    try {
      const authResult = await supabase.auth.getUser(token);
      userData = authResult.data as typeof userData;
      userError = authResult.error as typeof userError;
    } catch (authEx) {
      return new Response(JSON.stringify({ error: "auth_exception", debug: String(authEx) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token", debug: userError?.message ?? "user_null" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = (await req.json()) as QueryRequest;
    const {
      companyId,
      fetchEmployeesWithVerba,
      fetchAccountingGroups,
      accountingGroups,
      competencia,
      cpf,
      status,
      page = 1,
      pageSize = 50,
      documentId,
      fetchLogs,
    } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar permissão: super_admin ou permissão de card EC
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";

    if (!isSuperAdmin) {
      // Buscar UUID do card "Verbas Indenizatórias"
      const { data: cardRow } = await supabase
        .from("ec_cards")
        .select("id")
        .ilike("title", "Verbas Indenizat%")
        .eq("is_active", true)
        .maybeSingle();

      if (cardRow?.id) {
        const { data: cardPermission } = await supabase
          .rpc("has_card_permission", {
            _user_id: user.id,
            _card_id: cardRow.id,
            _permission: "view",
          });

        if (!cardPermission) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Verificar acesso à empresa
      const { data: userCompany } = await supabase
        .from("user_companies")
        .select("company_id, all_companies")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const hasCompanyAccess =
        userCompany?.all_companies ||
        userCompany?.company_id === companyId;

      if (!hasCompanyAccess) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Modo: buscar logs de um documento específico
    if (fetchLogs && documentId) {
      const { data: logs, error: logsError } = await supabase
        .from("verba_indenizatoria_logs")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });

      if (logsError) {
        return new Response(
          JSON.stringify({ error: "Falha ao consultar logs", details: logsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ logs: logs ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Modo: descobrir grupos contábeis disponíveis no DAB (sem sync)
    if (fetchAccountingGroups) {
      if (!competencia) {
        return new Response(
          JSON.stringify({ error: "competencia é obrigatória para fetchAccountingGroups" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const [yearStr] = competencia.split("-");
      const ano = parseInt(yearStr, 10);
      const mes = parseInt(competencia.split("-")[1], 10);

      if (isNaN(ano) || isNaN(mes)) {
        return new Response(
          JSON.stringify({ error: "Formato de competencia inválido. Use YYYY-MM" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const vsqUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/verbas-secure-query`;
      const vsqResp = await fetch(vsqUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
          "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({
          companyId,
          ano,
          mes,
          tipoVerba: "VERBA_INDENIZATORIA",
          fetchAll: true,
          autoSyncWhenEmpty: false,   // VI nunca dispara sync — usa dados já sincronizados pelo card Verbas
        }),
      });

      if (!vsqResp.ok) {
        const errText = await vsqResp.text();
        return new Response(
          JSON.stringify({ error: "Falha ao consultar verbas", details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const vsqData = await vsqResp.json();
      const rows: Array<Record<string, unknown>> = vsqData.rows ?? vsqData.data ?? [];

      const groups = [
        ...new Set(
          rows
            .map((r) => String(r.accounting_group || r.employee_accounting_group || "").trim())
            .filter((g) => g.length > 0),
        ),
      ].sort();

      return new Response(
        JSON.stringify({ groups }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Modo: listar funcionários com VERBA_INDENIZATORIA lançada na competência
    if (fetchEmployeesWithVerba) {
      if (!competencia) {
        return new Response(
          JSON.stringify({ error: "competencia é obrigatória para fetchEmployeesWithVerba" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Competencia no formato YYYY-MM
      const [yearStr] = competencia.split("-");
      const ano = parseInt(yearStr, 10);
      const mes = parseInt(competencia.split("-")[1], 10);

      if (isNaN(ano) || isNaN(mes)) {
        return new Response(
          JSON.stringify({ error: "Formato de competencia inválido. Use YYYY-MM" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Chamar verbas-secure-query com filtro VERBA_INDENIZATORIA
      const vsqUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/verbas-secure-query`;
      const vsqResp = await fetch(vsqUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
          "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({
          companyId,
          ano,
          mes,
          tipoVerba: "VERBA_INDENIZATORIA",
          fetchAll: true,
          autoSyncWhenEmpty: false,   // VI nunca dispara sync — usa dados já sincronizados pelo card Verbas
        }),
      });

      if (!vsqResp.ok) {
        const errText = await vsqResp.text();
        return new Response(
          JSON.stringify({ error: "Falha ao consultar verbas", details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const vsqData = await vsqResp.json();
      const rows: Array<Record<string, unknown>> = vsqData.rows ?? vsqData.data ?? [];

      // Mapear para campos normalizados
      const allEmployees = rows.map((r) => ({
        cpf: String(r.cpf || r.employee_cpf || ""),
        nome: String(r.nome || r.employee_name || ""),
        email: r.email || r.employee_email || null,
        valor_verba: Number(r.valor_verba || r.verba_indenizatoria || 0),
        valor_adiantamento: Number(r.valor_adiantamento || r.adiantamento || 0),
        department: r.department || r.employee_department || null,
        position: r.position || r.employee_position || null,
        unit: r.unit || r.employee_unit || null,
        accounting_group: String(r.accounting_group || r.employee_accounting_group || "").trim() || null,
      }));

      // Filtrar por grupos contábeis configurados (se informado)
      const employees = accountingGroups?.length
        ? allEmployees.filter((e) => accountingGroups.includes(e.accounting_group ?? ""))
        : allEmployees;

      return new Response(
        JSON.stringify({ employees }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Modo padrão: listar documentos gerados
    const offset = (Math.max(1, page) - 1) * pageSize;

    let query = supabase
      .from("verba_indenizatoria_documents")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (competencia) query = query.eq("competencia", competencia);
    if (cpf) query = query.eq("employee_cpf", cpf);
    if (status) query = query.eq("d4sign_status", status);

    const { data: rows, count, error: queryError } = await query;

    if (queryError) {
      return new Response(
        JSON.stringify({ error: "Falha ao consultar documentos", details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        page,
        pageSize,
        total: count ?? 0,
        rows: rows ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
