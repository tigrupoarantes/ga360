import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Send, FileText, Loader2, ExternalLink, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/external-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StockAuditReportViewerProps {
  auditId: string;
  reportHtml: string | null;
  reportSentAt: string | null;
  reportSentTo: string[] | null;
  onReportGenerated?: () => void;
}

export function StockAuditReportViewer({
  auditId,
  reportHtml,
  reportSentAt,
  reportSentTo,
  onReportGenerated,
}: StockAuditReportViewerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-stock-audit-report", {
        body: { auditId },
      });

      if (error) throw error;

      if (data?.emailSent) {
        toast.success("Relatório gerado e enviado com sucesso!");
        onReportGenerated?.();
      } else if (data?.reason === "no_email_configured") {
        toast.warning("E-mail de governança não configurado. Configure em Configurações > Auditoria.");
      } else {
        toast.info("Relatório gerado, mas não foi possível enviar o e-mail.");
        onReportGenerated?.();
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-stock-audit-report", {
        body: { auditId, resend: true },
      });

      if (error) throw error;

      if (data?.emailSent) {
        toast.success("Relatório reenviado com sucesso!");
        onReportGenerated?.();
      } else {
        toast.error("Não foi possível reenviar o relatório");
      }
    } catch (error) {
      console.error("Error resending report:", error);
      toast.error("Erro ao reenviar relatório");
    } finally {
      setIsResending(false);
    }
  };

  const openInNewTab = () => {
    if (!reportHtml) return;
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(reportHtml);
      newWindow.document.close();
    }
  };

  if (!reportHtml) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Relatório não gerado</p>
              <p className="text-sm text-muted-foreground">
                Clique no botão para gerar e enviar o relatório
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">Relatório disponível</p>
              <Badge variant="secondary" className="text-xs">
                Enviado
              </Badge>
            </div>
            {reportSentAt && (
              <p className="text-sm text-muted-foreground">
                Enviado em {format(new Date(reportSentAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
            {reportSentTo && reportSentTo.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Para: {reportSentTo.join(", ")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Relatório
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Relatório de Auditoria</DialogTitle>
                  <DialogDescription>
                    Visualização do relatório gerado
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto border rounded-lg">
                  <iframe
                    srcDoc={reportHtml}
                    className="w-full h-[600px]"
                    title="Relatório de Auditoria"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={openInNewTab}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleResend} disabled={isResending}>
              {isResending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Reenviar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
