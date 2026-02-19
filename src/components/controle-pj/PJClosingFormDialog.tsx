import { useState, useEffect, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePJClosings } from "@/hooks/useControlePJ";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import type { PJContract, PJClosingFormData, PJOtherItem } from "@/lib/pj-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PJClosingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: PJContract;
  competence: string;
  editingClosingId?: string;
  cardId?: string;
}

export function PJClosingFormDialog({
  open,
  onOpenChange,
  contract,
  competence,
  editingClosingId,
  cardId,
}: PJClosingFormDialogProps) {
  const { createClosing, updateClosing, closeCompetence, closings } = usePJClosings(contract.id);
  const { hasCardPermission } = useCardPermissions();
  const canManage = cardId ? hasCardPermission(cardId, "manage") : true;

  const existingClosing = editingClosingId
    ? closings.find((c) => c.id === editingClosingId)
    : null;

  const [form, setForm] = useState<PJClosingFormData>({
    contract_id: contract.id,
    competence,
    base_value: contract.monthly_value,
    restaurant_discount_value: 0,
    health_coparticipation_discount_value: 0,
    other_items: [],
    thirteenth_paid_value: 0,
    fourteenth_paid_value: 0,
  });

  const [include13th, setInclude13th] = useState(false);
  const [include14th, setInclude14th] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (existingClosing) {
      setForm({
        contract_id: contract.id,
        competence: existingClosing.competence,
        base_value: existingClosing.base_value,
        restaurant_discount_value: existingClosing.restaurant_discount_value,
        health_coparticipation_discount_value: existingClosing.health_coparticipation_discount_value,
        other_items: (existingClosing.other_items || []) as PJOtherItem[],
        thirteenth_paid_value: existingClosing.thirteenth_paid_value,
        fourteenth_paid_value: existingClosing.fourteenth_paid_value,
      });
      setInclude13th(existingClosing.thirteenth_paid_value > 0);
      setInclude14th(existingClosing.fourteenth_paid_value > 0);
    } else {
      setForm({
        contract_id: contract.id,
        competence,
        base_value: contract.monthly_value,
        restaurant_discount_value: 0,
        health_coparticipation_discount_value: 0,
        other_items: [],
        thirteenth_paid_value: 0,
        fourteenth_paid_value: 0,
      });
      setInclude13th(false);
      setInclude14th(false);
    }
  }, [contract, competence, existingClosing, open]);

  // Cálculos em tempo real
  const healthDependentsDiscount = contract.health_dependents_count * contract.health_dependent_unit_value;

  const otherEarnings = useMemo(
    () => form.other_items.filter((i) => i.type === "earning").reduce((s, i) => s + i.value, 0),
    [form.other_items]
  );
  const otherDiscounts = useMemo(
    () => form.other_items.filter((i) => i.type === "discount").reduce((s, i) => s + i.value, 0),
    [form.other_items]
  );

  const totalEarnings = form.base_value + otherEarnings + form.thirteenth_paid_value + form.fourteenth_paid_value;
  const totalDiscounts =
    form.restaurant_discount_value +
    healthDependentsDiscount +
    form.health_coparticipation_discount_value +
    otherDiscounts;
  const totalValue = totalEarnings - totalDiscounts;

  const addOtherItem = (type: "earning" | "discount") => {
    setForm({
      ...form,
      other_items: [...form.other_items, { description: "", value: 0, type }],
    });
  };

  const removeOtherItem = (index: number) => {
    setForm({
      ...form,
      other_items: form.other_items.filter((_, i) => i !== index),
    });
  };

  const updateOtherItem = (index: number, field: keyof PJOtherItem, value: string | number) => {
    const items = [...form.other_items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, other_items: items });
  };

  const handleSaveDraft = async () => {
    if (existingClosing) {
      await updateClosing.mutateAsync({ ...form, id: existingClosing.id });
    } else {
      await createClosing.mutateAsync(form);
    }
    onOpenChange(false);
  };

  const handleCloseCompetence = async () => {
    let closingId = existingClosing?.id;
    if (!closingId) {
      const result = await createClosing.mutateAsync(form);
      closingId = (result as any)?.id;
    } else {
      await updateClosing.mutateAsync({ ...form, id: closingId });
    }
    if (closingId) {
      await closeCompetence.mutateAsync(closingId);
    }
    onOpenChange(false);
  };

  const isSubmitting = createClosing.isPending || updateClosing.isPending || closeCompetence.isPending;
  const isDraft = !existingClosing || existingClosing.status === "draft";

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Fechamento — {contract.name}
              <Badge variant="outline" className="ml-2">
                {form.competence}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Competência */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Competência</Label>
                <Input
                  type="month"
                  value={form.competence}
                  onChange={(e) => setForm({ ...form, competence: e.target.value })}
                  disabled={!!existingClosing}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.base_value}
                  onChange={(e) => setForm({ ...form, base_value: parseFloat(e.target.value) || 0 })}
                  disabled={!isDraft}
                />
              </div>
            </div>

            {/* Descontos */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Descontos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Restaurante (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.restaurant_discount_value}
                    onChange={(e) =>
                      setForm({ ...form, restaurant_discount_value: parseFloat(e.target.value) || 0 })
                    }
                    disabled={!isDraft}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Dependentes (calculado): {contract.health_dependents_count} × {fmt(contract.health_dependent_unit_value)}
                  </Label>
                  <Input type="text" value={fmt(healthDependentsDiscount)} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Coparticipação (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.health_coparticipation_discount_value}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        health_coparticipation_discount_value: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!isDraft}
                  />
                </div>
              </div>
            </div>

            {/* 13º e 14º */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Gratificações</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contract.thirteenth_enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={include13th}
                        onCheckedChange={(v) => {
                          setInclude13th(v);
                          if (!v) setForm({ ...form, thirteenth_paid_value: 0 });
                          else setForm({ ...form, thirteenth_paid_value: contract.monthly_value });
                        }}
                        disabled={!isDraft}
                      />
                      <Label>Incluir 13º neste mês</Label>
                    </div>
                    {include13th && (
                      <Input
                        type="number"
                        step="0.01"
                        value={form.thirteenth_paid_value}
                        onChange={(e) =>
                          setForm({ ...form, thirteenth_paid_value: parseFloat(e.target.value) || 0 })
                        }
                        disabled={!isDraft}
                      />
                    )}
                  </div>
                )}
                {contract.fourteenth_enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={include14th}
                        onCheckedChange={(v) => {
                          setInclude14th(v);
                          if (!v) setForm({ ...form, fourteenth_paid_value: 0 });
                        }}
                        disabled={!isDraft}
                      />
                      <Label>Incluir 14º neste mês</Label>
                    </div>
                    {include14th && (
                      <Input
                        type="number"
                        step="0.01"
                        value={form.fourteenth_paid_value}
                        onChange={(e) =>
                          setForm({ ...form, fourteenth_paid_value: parseFloat(e.target.value) || 0 })
                        }
                        disabled={!isDraft}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Outros itens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Outros Itens
                </h3>
                {isDraft && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => addOtherItem("earning")}>
                      <Plus className="h-3 w-3 mr-1" /> Adicional
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => addOtherItem("discount")}>
                      <Plus className="h-3 w-3 mr-1" /> Desconto
                    </Button>
                  </div>
                )}
              </div>
              {form.other_items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant={item.type === "earning" ? "default" : "destructive"} className="shrink-0">
                    {item.type === "earning" ? "+" : "−"}
                  </Badge>
                  <Input
                    placeholder="Descrição"
                    value={item.description}
                    onChange={(e) => updateOtherItem(i, "description", e.target.value)}
                    className="flex-1"
                    disabled={!isDraft}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={item.value}
                    onChange={(e) => updateOtherItem(i, "value", parseFloat(e.target.value) || 0)}
                    className="w-32"
                    disabled={!isDraft}
                  />
                  {isDraft && (
                    <Button variant="ghost" size="icon" onClick={() => removeOtherItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Resumo */}
            <Separator />
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Proventos</span>
                  <span className="font-semibold text-green-600">{fmt(totalEarnings)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Descontos</span>
                  <span className="font-semibold text-red-600">- {fmt(totalDiscounts)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Líquido</span>
                  <span className={totalValue >= 0 ? "text-green-600" : "text-red-600"}>
                    {fmt(totalValue)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            {isDraft && (
              <>
                <Button variant="secondary" onClick={handleSaveDraft} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Rascunho
                </Button>
                {canManage && (
                  <Button onClick={() => setConfirmClose(true)} disabled={isSubmitting}>
                    Fechar Competência
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação para fechar competência */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar competência {form.competence}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao fechar, o holerite será gerado e enviado por e-mail para {contract.email}.
              O líquido será de <strong>{fmt(totalValue)}</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseCompetence}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar e Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
