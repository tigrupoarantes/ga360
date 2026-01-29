import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Package, Save, Loader2 } from "lucide-react";

export function StockAuditSettingsSection() {
  const queryClient = useQueryClient();
  const [governanceEmail, setGovernanceEmail] = useState("");
  const [ccEmailsText, setCcEmailsText] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["stock-audit-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_audit_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setGovernanceEmail(settings.governance_email || "");
      const ccEmails = settings.cc_emails as string[] || [];
      setCcEmailsText(ccEmails.join("\n"));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ccEmails = ccEmailsText
        .split("\n")
        .map((e) => e.trim())
        .filter((e) => e && e.includes("@"));

      if (settings?.id) {
        const { error } = await supabase
          .from("stock_audit_settings")
          .update({
            governance_email: governanceEmail.trim() || null,
            cc_emails: ccEmails,
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("stock_audit_settings")
          .insert({
            governance_email: governanceEmail.trim() || null,
            cc_emails: ccEmails,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audit-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações", { description: error.message });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Configurações de Auditoria de Estoque
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure os destinatários dos relatórios de auditoria
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destinatários do Relatório</CardTitle>
          <CardDescription>
            Os relatórios de auditoria serão enviados automaticamente para estes e-mails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="governance-email">E-mail do Responsável (Governança) *</Label>
            <Input
              id="governance-email"
              type="email"
              placeholder="governanca@empresa.com.br"
              value={governanceEmail}
              onChange={(e) => setGovernanceEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              E-mail principal que receberá todos os relatórios
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-emails">E-mails em Cópia (um por linha)</Label>
            <Textarea
              id="cc-emails"
              placeholder="controladoria@empresa.com.br&#10;diretor@empresa.com.br"
              value={ccEmailsText}
              onChange={(e) => setCcEmailsText(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Outros destinatários que receberão cópia dos relatórios
            </p>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
