import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/external-client";

interface Company {
  id?: string;
  name: string;
  cnpj?: string;
  is_active: boolean;
  is_auditable?: boolean;
  logo_url?: string;
  color?: string;
  accounting_group_code?: string;
  accounting_group_description?: string;
}

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
  onSuccess: () => void;
}

export function CompanyFormDialog({
  open,
  onOpenChange,
  company,
  onSuccess,
}: CompanyFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Company>({
    name: "",
    cnpj: "",
    is_active: true,
    is_auditable: false,
    logo_url: "",
    color: "#0B3D91",
    accounting_group_code: "",
    accounting_group_description: "",
  });

  useEffect(() => {
    if (open) {
      if (company) {
        setFormData(company);
      } else {
        setFormData({
          name: "",
          cnpj: "",
          is_active: true,
          is_auditable: false,
          logo_url: "",
          color: "#0B3D91",
          accounting_group_code: "",
          accounting_group_description: "",
        });
      }
    }
  }, [open, company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (company?.id) {
        const { error } = await supabase
          .from("companies")
          .update({
            name: formData.name,
            cnpj: formData.cnpj || null,
            is_active: formData.is_active,
            is_auditable: formData.is_auditable ?? false,
            logo_url: formData.logo_url || null,
            color: formData.color || null,
            accounting_group_code: formData.accounting_group_code || null,
            accounting_group_description: formData.accounting_group_description || null,
          })
          .eq("id", company.id);

        if (error) throw error;

        toast({
          title: "Empresa atualizada",
          description: "Os dados da empresa foram atualizados com sucesso.",
        });
      } else {
        const { error } = await supabase.from("companies").insert({
          name: formData.name,
          cnpj: formData.cnpj || null,
          is_active: formData.is_active,
          is_auditable: formData.is_auditable ?? false,
          logo_url: formData.logo_url || null,
          color: formData.color || null,
          accounting_group_code: formData.accounting_group_code || null,
          accounting_group_description: formData.accounting_group_description || null,
        });

        if (error) throw error;

        toast({
          title: "Empresa criada",
          description: "A nova empresa foi cadastrada com sucesso.",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {company ? "Editar Empresa" : "Nova Empresa"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Empresa *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: JArantes Distribuição Nestlé"
              required
            />
          </div>

          <div>
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <Label htmlFor="color">Cor Temática</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-20 h-10"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#0B3D91"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="logo_url">URL do Logo</Label>
            <Input
              id="logo_url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://exemplo.com/logo.png"
            />
          </div>

          <div className="space-y-3">
            <Label>Grupo de Contabilização</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="accounting_group_code">Código</Label>
                <Input
                  id="accounting_group_code"
                  value={formData.accounting_group_code || ""}
                  onChange={(e) => setFormData({ ...formData, accounting_group_code: e.target.value })}
                  placeholder="Ex: 1001"
                />
              </div>
              <div>
                <Label htmlFor="accounting_group_description">Descrição</Label>
                <Input
                  id="accounting_group_description"
                  value={formData.accounting_group_description || ""}
                  onChange={(e) => setFormData({ ...formData, accounting_group_description: e.target.value })}
                  placeholder="Ex: Distribuição SP"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="is_active">Empresa Ativa</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="is_auditable">Habilitada para Auditoria</Label>
            <Switch
              id="is_auditable"
              checked={formData.is_auditable ?? false}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_auditable: checked })
              }
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : company ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
