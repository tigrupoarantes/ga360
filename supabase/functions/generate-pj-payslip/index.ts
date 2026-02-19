import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import {
  PDFDocument,
  rgb,
  StandardFonts,
} from "https://esm.sh/pdf-lib@1.17.1";

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
// Helpers
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

// ---------------------------------------------------------------------------
// Replace accented characters with ASCII equivalents for Helvetica (which
// only supports WinAnsiEncoding and cannot render most non-ASCII glyphs).
// ---------------------------------------------------------------------------
function sanitize(text: string): string {
  const map: Record<string, string> = {
    "á": "a", "à": "a", "â": "a", "ã": "a", "ä": "a",
    "é": "e", "è": "e", "ê": "e", "ë": "e",
    "í": "i", "ì": "i", "î": "i", "ï": "i",
    "ó": "o", "ò": "o", "ô": "o", "õ": "o", "ö": "o",
    "ú": "u", "ù": "u", "û": "u", "ü": "u",
    "ç": "c",
    "Á": "A", "À": "A", "Â": "A", "Ã": "A", "Ä": "A",
    "É": "E", "È": "E", "Ê": "E", "Ë": "E",
    "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
    "Ó": "O", "Ò": "O", "Ô": "O", "Õ": "O", "Ö": "O",
    "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
    "Ç": "C",
    "ñ": "n", "Ñ": "N",
    "×": "x",
  };
  return text.replace(/[^\x00-\x7F]/g, (ch) => map[ch] ?? ch);
}

// ---------------------------------------------------------------------------
// PDF generation using pdf-lib (pure JS, no native deps)
// ---------------------------------------------------------------------------

async function generatePayslipPDF(
  contract: ContractRow,
  closing: ClosingRow,
): Promise<Uint8Array> {
  const companyName = contract.company?.[0]?.name || "Empresa";
  const costCenter = contract.cost_center?.[0]?.name || "--";
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
      ? [{ desc: "13o Salario", val: closing.thirteenth_paid_value }]
      : []),
    ...(closing.fourteenth_paid_value > 0
      ? [{ desc: "14o Salario", val: closing.fourteenth_paid_value }]
      : []),
    ...otherEarnings.map((i) => ({ desc: sanitize(i.description), val: i.value })),
  ];

  const discountRows = [
    ...(closing.restaurant_discount_value > 0
      ? [{ desc: "Vale Refeicao", val: closing.restaurant_discount_value }]
      : []),
    ...(closing.health_dependents_discount_value > 0
      ? [
          {
            desc: `Depend. Saude (${contract.health_dependents_count}x${formatBRL(contract.health_dependent_unit_value)})`,
            val: closing.health_dependents_discount_value,
          },
        ]
      : []),
    ...(closing.health_coparticipation_discount_value > 0
      ? [{ desc: "Coparticipacao Saude", val: closing.health_coparticipation_discount_value }]
      : []),
    ...otherDiscounts.map((i) => ({ desc: sanitize(i.description), val: i.value })),
  ];

  // ---- Create PDF ----
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Holerite PJ - ${sanitize(contract.name)} - ${closing.competence}`);
  pdfDoc.setSubject(`Competencia ${formatCompetence(closing.competence)}`);
  pdfDoc.setProducer("GA 360");

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const contentW = width - margin * 2;
  let y = height - margin;

  // Colors
  const blue = rgb(0.118, 0.251, 0.686);       // #1e40af
  const lightBlue = rgb(0.231, 0.510, 0.965);  // #3b82f6
  const darkText = rgb(0.067, 0.067, 0.067);   // #111
  const grayText = rgb(0.42, 0.44, 0.50);      // #6b7280
  const lineGray = rgb(0.90, 0.91, 0.93);      // #e5e7eb
  const bgLight = rgb(0.953, 0.957, 0.965);    // #f3f4f6
  const white = rgb(1, 1, 1);

  // ---- HEADER (blue bar) ----
  const headerH = 64;
  page.drawRectangle({
    x: margin,
    y: y - headerH,
    width: contentW,
    height: headerH,
    color: blue,
  });
  // Accent stripe
  page.drawRectangle({
    x: margin,
    y: y - headerH,
    width: contentW,
    height: 4,
    color: lightBlue,
  });
  page.drawText("HOLERITE PJ", {
    x: margin + 20,
    y: y - 30,
    size: 18,
    font: fontBold,
    color: white,
  });
  page.drawText(sanitize(`${companyName}  |  GA 360`), {
    x: margin + 20,
    y: y - 50,
    size: 10,
    font: fontRegular,
    color: rgb(0.82, 0.87, 0.95),
  });
  y -= headerH + 20;

  // ---- INFO SECTION ----
  const infoFields = [
    { label: "Prestador:", value: sanitize(contract.name) },
    { label: "Documento:", value: contract.document || "--" },
    { label: "Centro de Custo:", value: sanitize(costCenter) },
    { label: "Competencia:", value: sanitize(formatCompetence(closing.competence)) },
  ];

  for (const field of infoFields) {
    page.drawText(field.label, {
      x: margin + 10,
      y,
      size: 9,
      font: fontRegular,
      color: grayText,
    });
    const labelW = fontRegular.widthOfTextAtSize(field.label, 9);
    page.drawText(` ${field.value}`, {
      x: margin + 10 + labelW + 2,
      y,
      size: 10,
      font: fontBold,
      color: darkText,
    });
    y -= 18;
  }

  // Divider line
  y -= 4;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentW, y },
    thickness: 1,
    color: lineGray,
  });
  y -= 20;

  // ---- HELPER: draw a table section ----
  function drawSectionTitle(title: string) {
    page.drawText(title.toUpperCase(), {
      x: margin + 10,
      y,
      size: 10,
      font: fontBold,
      color: grayText,
    });
    y -= 20;
  }

  function drawTableRow(
    desc: string,
    val: string,
    bold = false,
    accentColor?: typeof blue,
  ) {
    const font = bold ? fontBold : fontRegular;
    const color = accentColor || darkText;
    const size = bold ? 11 : 10;

    page.drawText(desc, {
      x: margin + 14,
      y,
      size,
      font,
      color,
    });
    const valW = font.widthOfTextAtSize(val, size);
    page.drawText(val, {
      x: margin + contentW - 14 - valW,
      y,
      size,
      font,
      color,
    });
    y -= 6;
    // Subtle bottom border
    page.drawLine({
      start: { x: margin + 10, y },
      end: { x: margin + contentW - 10, y },
      thickness: 0.5,
      color: lineGray,
    });
    y -= 16;
  }

  // ---- PROVENTOS ----
  drawSectionTitle("Proventos");
  for (const row of earningRows) {
    drawTableRow(row.desc, formatBRL(row.val));
  }
  drawTableRow("Total Proventos", formatBRL(totalEarnings), true);
  y -= 10;

  // ---- DESCONTOS ----
  if (discountRows.length > 0) {
    drawSectionTitle("Descontos");
    for (const row of discountRows) {
      drawTableRow(row.desc, `- ${formatBRL(row.val)}`);
    }
    drawTableRow("Total Descontos", `- ${formatBRL(totalDiscounts)}`, true);
    y -= 10;
  }

  // ---- VALOR LÍQUIDO (highlighted) ----
  const netBoxH = 44;
  page.drawRectangle({
    x: margin,
    y: y - netBoxH,
    width: contentW,
    height: netBoxH,
    color: bgLight,
  });
  // Top accent line
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentW, y },
    thickness: 2,
    color: blue,
  });

  const netLabel = "VALOR LIQUIDO";
  const netValue = formatBRL(closing.total_value);
  page.drawText(netLabel, {
    x: margin + 14,
    y: y - 28,
    size: 13,
    font: fontBold,
    color: darkText,
  });
  const netValW = fontBold.widthOfTextAtSize(netValue, 16);
  page.drawText(netValue, {
    x: margin + contentW - 14 - netValW,
    y: y - 30,
    size: 16,
    font: fontBold,
    color: blue,
  });
  y -= netBoxH + 30;

  // ---- FOOTER ----
  const footerText1 = sanitize(
    `Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
  );
  const footerText2 = "GA 360 - Sistema de Governanca Corporativa";

  const ft1W = fontRegular.widthOfTextAtSize(footerText1, 8);
  const ft2W = fontRegular.widthOfTextAtSize(footerText2, 8);

  page.drawText(footerText1, {
    x: (width - ft1W) / 2,
    y: margin + 16,
    size: 8,
    font: fontRegular,
    color: grayText,
  });
  page.drawText(footerText2, {
    x: (width - ft2W) / 2,
    y: margin + 4,
    size: 8,
    font: fontRegular,
    color: grayText,
  });

  return await pdfDoc.save();
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

    console.log(`[generate-pj-payslip] Generating PDF payslip for closing: ${closingId}`);

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

    // ---- Generate PDF payslip ----
    const pdfBytes = await generatePayslipPDF(
      contract as unknown as ContractRow,
      closing as unknown as ClosingRow,
    );

    // ---- Upload to Storage ----
    const filePath = `${closing.contract_id}/${closing.competence}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("holerites")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading payslip:", uploadError);
      throw new Error("Erro ao fazer upload do holerite: " + uploadError.message);
    }

    console.log(`[generate-pj-payslip] Uploaded PDF to holerites/${filePath}`);

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
