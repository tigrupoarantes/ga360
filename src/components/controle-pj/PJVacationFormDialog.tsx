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
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CalendarDays, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePJVacation } from "@/hooks/useControlePJ";
import type { PJContract, PJVacationFormData } from "@/lib/pj-types";

interface PJVacationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: PJContract;
  year?: number;
}

export function PJVacationFormDialog({ open, onOpenChange, contract, year }: PJVacationFormDialogProps) {
  const currentYear = year || new Date().getFullYear();
  const { balance, createEvent } = usePJVacation(contract.id, currentYear);

  const [form, setForm] = useState<PJVacationFormData>({
    contract_id: contract.id,
    start_date: "",
    end_date: "",
    days: 1,
    note: null,
  });

  useEffect(() => {
    if (open) {
      setForm({
        contract_id: contract.id,
        start_date: "",
        end_date: "",
        days: 1,
        note: null,
      });
    }
  }, [open, contract.id]);

  // Calcular dias automaticamente quando datas são preenchidas
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0 && diffDays <= 30) {
        setForm((prev) => ({ ...prev, days: diffDays }));
      }
    }
  }, [form.start_date, form.end_date]);

  const remaining = balance?.remaining_days ?? 30;
  const exceedsSaldo = form.days > remaining;

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date || exceedsSaldo) return;
    await createEvent.mutateAsync(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Lançar Folga — {contract.name}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Saldo atual */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo {currentYear}</p>
                  <p className="text-2xl font-bold">
                    {remaining} <span className="text-sm font-normal text-muted-foreground">dias restantes</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Utilizado</p>
                  <p className="text-lg font-semibold">{balance?.used_days || 0} / {balance?.entitlement_days || 30}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={form.days}
              onChange={(e) => setForm({ ...form, days: parseInt(e.target.value) || 1 })}
            />
          </div>

          {exceedsSaldo && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Dias solicitados ({form.days}) excedem o saldo disponível ({remaining}).
                Não é possível registrar esta folga.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              value={form.note || ""}
              onChange={(e) => setForm({ ...form, note: e.target.value || null })}
              rows={2}
              placeholder="Ex: Viagem pessoal"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createEvent.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createEvent.isPending || !form.start_date || !form.end_date || exceedsSaldo}
          >
            {createEvent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Folga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
