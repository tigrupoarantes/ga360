import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OtherItem {
  description: string;
  value: number;
  type: "earning" | "discount";
}

interface ClosingRow {
  id: string;
  contract_id: string;
  competence: string;
  base_value: number;
  restaurant_discount_value: number;
  health_dependents_discount_value: number;
  health_coparticipation_discount_value: number;
  other_items: OtherItem[] | null;
  thirteenth_paid_value: number;
  fourteenth_paid_value: number;
  total_value: number;
  status: string;
}

interface ContractRow {
  id: string;
  name: string;
  document: string;
  email: string;
  monthly_value: number;
  payment_day: number;
  health_enabled: boolean;
  health_dependent_unit_value: number;
  health_dependents_count: number;
  thirteenth_enabled: boolean;
  fourteenth_enabled: boolean;
  company: { name: string }[] | null;
  cost_center: { name: string }[] | null;
}

// ---------------------------------------------------------------------------
// PDF generation via HTML → simple text-based "payslip" stored as HTML
// Edge Functions on Deno Deploy don't have native PDF libs, so we generate
// a professional HTML payslip, convert it to a self-contained HTML file and
// store it in the "holerites" bucket. The front-end can later render it with
// <iframe> or open it in a new tab (the browser print dialog produces a PDF).
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompetence(comp: string): string {
  const [year, month] = comp.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[parseInt(month, 10) - 1]} / ${year}`;
}

function generatePayslipHTML(
  contract: ContractRow,
  closing: ClosingRow,
): string {
  const companyName = contract.company?.[0]?.name || "Empresa";
  const costCenter = contract.cost_center?.[0]?.name || "—";
  const otherItems: OtherItem[] = closing.other_items || [];
  const otherEarnings = otherItems.filter((i) => i.type === "earning");
  const otherDiscounts = otherItems.filter((i) => i.type === "discount");

  const totalEarnings =
    closing.base_value +
    closing.thirteenth_paid_value +
    closing.fourteenth_paid_value +
    otherEarnings.reduce((s, i) => s + i.value, 0);

  const totalDiscounts =
    closing.restaurant_discount_value +
    closing.health_dependents_discount_value +
    closing.health_coparticipation_discount_value +
    otherDiscounts.reduce((s, i) => s + i.value, 0);

  const earningRows = [
    { desc: "Valor Base Mensal", val: closing.base_value },
    ...(closing.thirteenth_paid_value > 0
      ? [{ desc: "13º Salário", val: closing.thirteenth_paid_value }]
      : []),
    ...(closing.fourteenth_paid_value > 0
      ? [{ desc: "14º Salário", val: closing.fourteenth_paid_value }]
      : []),
    ...otherEarnings.map((i) => ({ desc: i.description, val: i.value })),
  ];

  const discountRows = [
    ...(closing.restaurant_discount_value > 0
      ? [{ desc: "Vale Refeição", val: closing.restaurant_discount_value }]
      : []),
    ...(closing.health_dependents_discount_value > 0
      ? [
          {
            desc: `Dependentes Saúde (${contract.health_dependents_count}×${formatBRL(contract.health_dependent_unit_value)})`,
            val: closing.health_dependents_discount_value,
          },
        ]
      : []),
    ...(closing.health_coparticipation_discount_value > 0
      ? [{ desc: "Coparticipação Saúde", val: closing.health_coparticipation_discount_value }]
      : []),
    ...otherDiscounts.map((i) => ({ desc: i.description, val: i.value })),
  ];

  const tableRow = (desc: string, val: string, bold = false) =>
    `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;${bold ? "font-weight:700;" : ""}">${desc}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;${bold ? "font-weight:700;" : ""}">${val}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Holerite PJ – ${contract.name} – ${closing.competence}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; background: #f9fafb; color: #1f2937; }
    .container { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #fff; padding: 24px 28px; }
    .header h1 { margin: 0; font-size: 20px; } .header p { margin: 4px 0 0; opacity: .85; font-size: 13px; }
    .info { display: flex; flex-wrap: wrap; gap: 8px 32px; padding: 18px 28px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .info span { color: #6b7280; } .info strong { color: #111827; }
    .section { padding: 14px 28px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .total-row td { border-top: 2px solid #1e40af; font-weight: 700; font-size: 15px; padding-top: 10px; }
    .footer { padding: 14px 28px; background: #f3f4f6; text-align: center; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>HOLERITE PJ</h1>
    <p>${companyName} · GA 360</p>
  </div>

  <div class="info">
    <div><span>Prestador:</span> <strong>${contract.name}</strong></div>
    <div><span>Documento:</span> <strong>${contract.document}</strong></div>
    <div><span>Centro de Custo:</span> <strong>${costCenter}</strong></div>
    <div><span>Competência:</span> <strong>${formatCompetence(closing.competence)}</strong></div>
  </div>

  <div class="section">
    <p class="section-title">Proventos</p>
    <table>
      ${earningRows.map((r) => tableRow(r.desc, formatBRL(r.val))).join("")}
      ${tableRow("Total Proventos", formatBRL(totalEarnings), true)}
    </table>
  </div>

  ${discountRows.length > 0 ? `
  <div class="section" style="padding-top:0">
    <p class="section-title">Descontos</p>
    <table>
      ${discountRows.map((r) => tableRow(r.desc, `- ${formatBRL(r.val)}`)).join("")}
      ${tableRow("Total Descontos", `- ${formatBRL(totalDiscounts)}`, true)}
    </table>
  </div>` : ""}

  <div class="section" style="padding-top:0">
    <table>
      <tr class="total-row">
        <td style="padding:10px 10px 6px;">VALOR LÍQUIDO</td>
        <td style="padding:10px 10px 6px; text-align:right; color:#1e40af;">${formatBRL(closing.total_value)}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}<br/>
    GA 360 · Sistema de Governança Corporativa
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { closingId } = await req.json();

    if (!closingId) {
      throw new Error("closingId is required");
    }

    console.log(`[generate-pj-payslip] Generating payslip for closing: ${closingId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Fetch closing ----
    const { data: closing, error: closingError } = await supabase
      .from("pj_closings")
      .select("*")
      .eq("id", closingId)
      .single();

    if (closingError || !closing) {
      console.error("Error fetching closing:", closingError);
      throw new Error("Fechamento não encontrado");
    }

    // ---- Fetch contract (with company & cost center) ----
    const { data: contract, error: contractError } = await supabase
      .from("pj_contracts")
      .select(`
        *,
        company:companies!pj_contracts_company_id_fkey(name),
        cost_center:areas!pj_contracts_cost_center_id_fkey(name)
      `)
      .eq("id", closing.contract_id)
      .single();

    if (contractError || !contract) {
      console.error("Error fetching contract:", contractError);
      throw new Error("Contrato PJ não encontrado");
    }

    // ---- Generate HTML payslip ----
    const html = generatePayslipHTML(contract as unknown as ContractRow, closing as unknown as ClosingRow);
    const htmlBytes = new TextEncoder().encode(html);

    // ---- Upload to Storage ----
    const filePath = `${closing.contract_id}/${closing.competence}.html`;

    const { error: uploadError } = await supabase.storage
      .from("holerites")
      .upload(filePath, htmlBytes, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading payslip:", uploadError);
      throw new Error("Erro ao fazer upload do holerite: " + uploadError.message);
    }

    console.log(`[generate-pj-payslip] Uploaded to holerites/${filePath}`);

    // ---- Update closing record ----
    const { error: updateError } = await supabase
      .from("pj_closings")
      .update({
        payslip_pdf_url: filePath,
        payslip_generated_at: new Date().toISOString(),
      })
      .eq("id", closingId);

    if (updateError) {
      console.error("Error updating closing:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payslipUrl: filePath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[generate-pj-payslip] Error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
