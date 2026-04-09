import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

interface QueryRequest {
  companyId?: string;
  fetchEmployeesWithVerba?: boolean;
  fetchAccountingGroups?: boolean;
  fetchCnpjGroups?: boolean;
  accountingGroups?: string[];
  cnpjFilter?: string[];
  cnpj?: string;
  competencia?: string;
  cpf?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  documentId?: string;
  fetchLogs?: boolean;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token", debug: userError?.message ?? "user_null" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = (await req.json()) as QueryRequest;
    const {
      companyId,
      fetchEmployeesWithVerba,
      fetchAccountingGroups,
      fetchCnpjGroups,
      accountingGroups,
      cnpjFilter,
      cnpj,
      competencia,
      cpf,
      status,
      page = 1,
      pageSize = 50,
      documentId,
      fetchLogs,
    } = body;

    // Verificar permissão: super_admin ou permissão de card EC
    const { data: userRoleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRole = (userRoleRow?.role as string) ?? "";
    const isSuperAdmin = userRole === "super_admin";
    const isLeadership = ["super_admin", "ceo", "diretor"].includes(userRole);

    // companyId é obrigatório para roles não-liderança
    if (!companyId && !isLeadership) {
      return new Response(JSON.stringify({ error: "companyId é obrigatório" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

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
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }

      // Verificar acesso à empresa (pular se visão global de liderança)
      if (companyId) {
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
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
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
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ logs: logs ?? [] }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Mapeamento mês (número) → nome da coluna em payroll_verba_pivot
    const MES_MAP: Record<string, string> = {
      "01": "janeiro",  "02": "fevereiro", "03": "marco",
      "04": "abril",    "05": "maio",      "06": "junho",
      "07": "julho",    "08": "agosto",    "09": "setembro",
      "10": "outubro",  "11": "novembro",  "12": "dezembro",
    };

    // Modo: descobrir grupos contábeis disponíveis (lê payroll_verba_pivot diretamente)
    if (fetchAccountingGroups) {
      if (!competencia) {
        return new Response(
          JSON.stringify({ error: "competencia é obrigatória para fetchAccountingGroups" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const [yearStr, mesStr] = competencia.split("-");
      const ano = parseInt(yearStr, 10);

      if (isNaN(ano) || !mesStr) {
        return new Response(
          JSON.stringify({ error: "Formato de competencia inválido. Use YYYY-MM" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const { data: groupRows, error: groupsError } = await supabase
        .from("payroll_verba_pivot")
        .select("employee_accounting_group")
        .eq("company_id", companyId)
        .eq("ano", ano)
        .ilike("tipo_verba", "%INDENIZ%")
        .not("employee_accounting_group", "is", null);

      if (groupsError) {
        return new Response(
          JSON.stringify({ error: "Falha ao consultar grupos", details: groupsError.message }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const groups = [
        ...new Set(
          (groupRows ?? [])
            .map((r) => String(r.employee_accounting_group || "").trim())
            .filter((g) => g.length > 0),
        ),
      ].sort();

      return new Response(
        JSON.stringify({ groups }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Modo: descobrir CNPJs (empresas de registro CLT) disponíveis para a competência
    if (fetchCnpjGroups) {
      if (!competencia) {
        return new Response(
          JSON.stringify({ error: "competencia é obrigatória para fetchCnpjGroups" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const [yearStr] = competencia.split("-");
      const ano = parseInt(yearStr, 10);

      if (isNaN(ano)) {
        return new Response(
          JSON.stringify({ error: "Formato de competencia inválido. Use YYYY-MM" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      // Buscar CNPJs distintos — prioridade: contract_company (registro CLT), fallback: accounting_company
      // Supabase JS não suporta COALESCE em select, então buscamos ambos e fazemos merge no código
      const { data: cnpjRows, error: cnpjError } = await supabase
        .from("payroll_verba_pivot")
        .select(`employee_contract_company_id, employee_accounting_company_id,
          contract_co:employee_contract_company_id(external_id, name),
          accounting_co:employee_accounting_company_id(external_id, name)`)
        .eq("company_id", companyId)
        .eq("ano", ano)
        .ilike("tipo_verba", "%INDENIZ%");

      if (cnpjError) {
        return new Response(
          JSON.stringify({ error: "Falha ao consultar CNPJs", details: cnpjError.message }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      // Deduplicar por CNPJ — prioridade: contract, fallback: accounting
      const cnpjMap = new Map<string, { cnpj: string; companyName: string }>();
      for (const row of cnpjRows ?? []) {
        const contract = row.contract_co as unknown as { external_id: string; name: string } | null;
        const accounting = row.accounting_co as unknown as { external_id: string; name: string } | null;
        const comp = contract?.external_id ? contract : accounting;
        if (comp?.external_id && comp.external_id.length > 5) { // filtrar external_id inválidos (ex: "2")
          cnpjMap.set(comp.external_id, {
            cnpj: comp.external_id,
            companyName: comp.name || "",
          });
        }
      }

      const cnpjGroups = [...cnpjMap.values()].sort((a, b) => a.companyName.localeCompare(b.companyName));

      return new Response(
        JSON.stringify({ cnpjGroups }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Modo: listar funcionários com VERBA_INDENIZATORIA lançada na competência
    // Lê diretamente de payroll_verba_pivot via RPC (agrega verba + adiantamento por CPF)
    if (fetchEmployeesWithVerba) {
      if (!competencia) {
        return new Response(
          JSON.stringify({ error: "competencia é obrigatória para fetchEmployeesWithVerba" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const [yearStr, mesStr] = competencia.split("-");
      const ano = parseInt(yearStr, 10);
      const mesNome = MES_MAP[mesStr];

      if (isNaN(ano) || !mesNome) {
        return new Response(
          JSON.stringify({ error: "Formato de competencia inválido. Use YYYY-MM" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const { data: rows, error: rpcError } = await supabase
        .rpc("get_vi_employees_for_competencia", {
          p_company_id: companyId,
          p_ano: ano,
          p_mes_nome: mesNome,
        });

      if (rpcError) {
        return new Response(
          JSON.stringify({ error: "Falha ao consultar funcionários", details: rpcError.message }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const allEmployees = (rows ?? []).map((r: Record<string, unknown>) => ({
        cpf: String(r.cpf || ""),
        nome: String(r.nome_funcionario || ""),
        email: r.employee_email ?? null,
        valor_verba: Number(r.valor_verba ?? 0),
        valor_adiantamento: Number(r.valor_adiantamento ?? 0),
        department: r.employee_department ?? null,
        position: r.employee_position ?? null,
        unit: r.employee_unidade ?? null,
        accounting_group: String(r.employee_accounting_group || "").trim() || null,
        accounting_company_cnpj: r.accounting_company_cnpj ?? null,
        accounting_company_name: r.accounting_company_name ?? null,
      }));

      // Filtrar por CNPJ (prioridade) ou por grupos contábeis (backward compat)
      let employees = allEmployees;
      if (cnpjFilter?.length) {
        employees = allEmployees.filter((e) => cnpjFilter.includes(e.accounting_company_cnpj ?? ""));
      } else if (accountingGroups?.length) {
        employees = allEmployees.filter((e) => accountingGroups.includes(e.accounting_group ?? ""));
      }

      return new Response(
        JSON.stringify({ employees }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Modo padrão: listar documentos gerados
    const offset = (Math.max(1, page) - 1) * pageSize;

    let query = supabase
      .from("verba_indenizatoria_documents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (companyId) query = query.eq("company_id", companyId);
    if (competencia) query = query.eq("competencia", competencia);
    if (cpf) query = query.eq("employee_cpf", cpf);
    if (status) query = query.eq("d4sign_status", status);
    if (cnpj) query = query.eq("employee_accounting_cnpj", cnpj);

    const { data: rows, count, error: queryError } = await query;

    if (queryError) {
      return new Response(
        JSON.stringify({ error: "Falha ao consultar documentos", details: queryError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Stats: contar por grupo de status (mesmos filtros, sem paginação)
    let statsQuery = supabase
      .from("verba_indenizatoria_documents")
      .select("d4sign_status");

    if (companyId) statsQuery = statsQuery.eq("company_id", companyId);
    if (competencia) statsQuery = statsQuery.eq("competencia", competencia);
    if (cpf) statsQuery = statsQuery.eq("employee_cpf", cpf);
    if (status) statsQuery = statsQuery.eq("d4sign_status", status);
    if (cnpj) statsQuery = statsQuery.eq("employee_accounting_cnpj", cnpj);

    const { data: statusRows } = await statsQuery;

    const stats = { signed: 0, pending: 0, awaiting: 0, errors: 0 };
    for (const r of statusRows ?? []) {
      const s = r.d4sign_status;
      if (s === "signed") stats.signed++;
      else if (["draft", "uploaded", "signers_added"].includes(s)) stats.pending++;
      else if (["sent_to_sign", "waiting_signature"].includes(s)) stats.awaiting++;
      else if (["error", "expired", "cancelled"].includes(s)) stats.errors++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        page,
        pageSize,
        total: count ?? 0,
        rows: rows ?? [],
        stats,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }
});
