import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface KeyResultUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: any;
}

export function KeyResultUpdateDialog({
  open,
  onOpenChange,
  keyResult,
}: KeyResultUpdateDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState("");
  const [notes, setNotes] = useState("");

  if (!keyResult) return null;

  const currentProgress =
    keyResult.target_value > keyResult.start_value
      ? ((keyResult.current_value - keyResult.start_value) /
          (keyResult.target_value - keyResult.start_value)) *
        100
      : 0;

  const newProgress =
    newValue && keyResult.target_value > keyResult.start_value
      ? ((parseFloat(newValue) - keyResult.start_value) /
          (keyResult.target_value - keyResult.start_value)) *
        100
      : currentProgress;

  const mutation = useMutation({
    mutationFn: async () => {
      const valueNum = parseFloat(newValue);
      if (isNaN(valueNum)) throw new Error("Valor inválido");

      // Create update record
      const { error: updateError } = await supabase
        .from("okr_key_result_updates")
        .insert({
          key_result_id: keyResult.id,
          previous_value: keyResult.current_value,
          new_value: valueNum,
          notes: notes || null,
          created_by: user?.id,
        });
      if (updateError) throw updateError;

      // Update KR current value and status
      let status = "on_track";
      if (valueNum >= keyResult.target_value) {
        status = "completed";
      } else if (newProgress < 30) {
        status = "behind";
      } else if (newProgress < 70) {
        status = "at_risk";
      }

      const { error: krError } = await supabase
        .from("okr_key_results")
        .update({
          current_value: valueNum,
          status,
        })
        .eq("id", keyResult.id);
      if (krError) throw krError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okr-objectives"] });
      toast.success("Progresso atualizado");
      onOpenChange(false);
      setNewValue("");
      setNotes("");
    },
    onError: () => {
      toast.error("Erro ao atualizar progresso");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Key Result</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{keyResult.title}</h3>
            {keyResult.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {keyResult.description}
              </p>
            )}
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Progresso Atual</span>
              <span className="font-medium">
                {keyResult.current_value} / {keyResult.target_value}{" "}
                {keyResult.unit}
              </span>
            </div>
            <Progress value={Math.min(100, Math.max(0, currentProgress))} />
            <div className="text-xs text-muted-foreground text-center">
              {Math.round(currentProgress)}% concluído
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Novo Valor</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  step="0.01"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={`Atual: ${keyResult.current_value}`}
                  className="flex-1"
                />
                <span className="text-muted-foreground">{keyResult.unit}</span>
              </div>
              {newValue && (
                <div className="text-sm text-muted-foreground">
                  Novo progresso: {Math.round(Math.min(100, Math.max(0, newProgress)))}%
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentários sobre esta atualização..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!newValue || mutation.isPending}
              >
                {mutation.isPending ? "Salvando..." : "Atualizar"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
