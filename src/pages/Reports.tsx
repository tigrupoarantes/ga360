import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ReportAssistant } from "@/components/reports/ReportAssistant";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { toast } from "sonner";
import jsPDF from "jspdf";

export default function Reports() {
  const [reportContent, setReportContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleExportPdf = useCallback(() => {
    if (!reportContent) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - margin * 2;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório GA 360", margin, 20);

      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(128, 128, 128);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, 28);

      // Content
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);

      // Clean markdown for PDF
      const cleanContent = reportContent
        .replace(/<!-- CHART:.*?-->/g, "")
        .replace(/<!-- \/CHART -->/g, "")
        .replace(/\*\*/g, "")
        .replace(/#{1,3}\s/g, "")
        .replace(/\[CHART:\d+\]/g, "[Gráfico - ver versão digital]");

      const lines = doc.splitTextToSize(cleanContent, maxWidth);
      let y = 40;
      const lineHeight = 6;

      lines.forEach((line: string) => {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });

      doc.save(`relatorio-ga360-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    }
  }, [reportContent]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Use o assistente de IA para gerar relatórios personalizados
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
          <ReportAssistant
            onReportGenerated={setReportContent}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
          <ReportViewer
            content={reportContent}
            onExportPdf={handleExportPdf}
            isLoading={isLoading}
          />
        </div>
      </div>
    </MainLayout>
  );
}
