import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { useCompany } from "@/contexts/CompanyContext";
import { usePJContract } from "@/hooks/useControlePJ";
import type { PJContract, PJContractFormData } from "@/lib/pj-types";

interface PJContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingContract: PJContract | null;
}

export function PJContractFormDialog({ open, onOpenChange, editingContract }: PJContractFormDialogProps) {
  const { selectedCompanyId, companies } = useCompany();
  const { createContract, updateContract } = usePJContract(editingContract?.id);
  const isEditing = !!editingContract;

  const [form, setForm] = useState<PJContractFormData>({
    company_id: selectedCompanyId || "",
    name: "",
    document: "",
    email: "",
    manager_user_id: null,
    cost_center_id: null,
    monthly_value: 0,
    payment_day: 10,
    status: "active",
    vacation_enabled: true,
    vacation_entitlement_days: 30,
    thirteenth_enabled: true,
    thirteenth_payment_month: 12,
    fourteenth_enabled: false,
    fourteenth_mode: "manual_by_goal",
    health_enabled: true,
    health_dependent_unit_value: 0,
    health_dependents_count: 0,
    notes: null,
  });

  // Preencher form ao editar
  useEffect(() => {
    if (editingContract) {
      setForm({
        company_id: editingContract.company_id,
        name: editingContract.name,
        document: editingContract.document,
        email: editingContract.email,
        manager_user_id: editingContract.manager_user_id,
        cost_center_id: editingContract.cost_center_id,
        monthly_value: editingContract.monthly_value,
        payment_day: editingContract.payment_day,
        status: editingContract.status,
        vacation_enabled: editingContract.vacation_enabled,
        vacation_entitlement_days: editingContract.vacation_entitlement_days,
        thirteenth_enabled: editingContract.thirteenth_enabled,
        thirteenth_payment_month: editingContract.thirteenth_payment_month,
        fourteenth_enabled: editingContract.fourteenth_enabled,
        fourteenth_mode: editingContract.fourteenth_mode,
        health_enabled: editingContract.health_enabled,
        health_dependent_unit_value: editingContract.health_dependent_unit_value,
        health_dependents_count: editingContract.health_dependents_count,
        notes: editingContract.notes,
      });
    } else {
      setForm((prev) => ({
        ...prev,
        company_id: selectedCompanyId || "",
        name: "",
        document: "",
        email: "",
        manager_user_id: null,
        cost_center_id: null,
        monthly_value: 0,
        payment_day: 10,
        status: "active",
        notes: null,
      }));
    }
  }, [editingContract, selectedCompanyId, open]);

  // Buscar gestores (profiles)
  const { data: managers } = useQuery({
    queryKey: ["profiles-for-pj"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Buscar áreas (centros de custo)
  const { data: areas } = useQuery({
    queryKey: ["areas-for-pj", form.company_id],
    queryFn: async () => {
      let query = supabase.from("areas").select("id, name").order("name");
      if (form.company_id) {
        query = query.eq("company_id", form.company_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!form.company_id,
  });

  const handleSubmit = async () => {
    if (!form.name || !form.document || !form.email || !form.company_id) return;

    if (isEditing && editingContract) {
      await updateContract.mutateAsync({ ...form, id: editingContract.id });
    } else {
      await createContract.mutateAsync(form);
    }
    onOpenChange(false);
  };

  const isSubmitting = createContract.isPending || updateContract.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Contrato PJ" : "Novo Contrato PJ"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dados básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: 'active' | 'suspended' | 'ended') => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="ended">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome / Razão Social *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Documento (CNPJ/CPF) *</Label>
              <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Valor Mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.monthly_value}
                onChange={(e) => setForm({ ...form, monthly_value: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Gestor Responsável</Label>
              <Select
                value={form.manager_user_id || "none"}
                onValueChange={(v) => setForm({ ...form, manager_user_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {managers?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Centro de Custo / Área</Label>
              <Select
                value={form.cost_center_id || "none"}
                onValueChange={(v) => setForm({ ...form, cost_center_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {areas?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dia de Pagamento</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.payment_day || ""}
                onChange={(e) => setForm({ ...form, payment_day: parseInt(e.target.value) || null })}
              />
            </div>
          </div>

          {/* Configurações */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Configurações</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Banco de Folgas</p>
                  <p className="text-xs text-muted-foreground">{form.vacation_entitlement_days} dias/ano</p>
                </div>
                <Switch
                  checked={form.vacation_enabled}
                  onCheckedChange={(v) => setForm({ ...form, vacation_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">13º Salário</p>
                  <p className="text-xs text-muted-foreground">Mês: {form.thirteenth_payment_month}</p>
                </div>
                <Switch
                  checked={form.thirteenth_enabled}
                  onCheckedChange={(v) => setForm({ ...form, thirteenth_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">14º (Meta)</p>
                  <p className="text-xs text-muted-foreground">Valor manual por meta do grupo</p>
                </div>
                <Switch
                  checked={form.fourteenth_enabled}
                  onCheckedChange={(v) => setForm({ ...form, fourteenth_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Plano de Saúde</p>
                  <p className="text-xs text-muted-foreground">
                    {form.health_dependents_count} dep. × R$ {form.health_dependent_unit_value}
                  </p>
                </div>
                <Switch
                  checked={form.health_enabled}
                  onCheckedChange={(v) => setForm({ ...form, health_enabled: v })}
                />
              </div>
            </div>

            {form.health_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label>Nº Dependentes</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.health_dependents_count}
                    onChange={(e) => setForm({ ...form, health_dependents_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor por Dependente (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.health_dependent_unit_value}
                    onChange={(e) =>
                      setForm({ ...form, health_dependent_unit_value: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.name || !form.document || !form.email}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar" : "Criar Contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
