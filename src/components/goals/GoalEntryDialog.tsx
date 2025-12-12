import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  value: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  entry_date: z.string().min(1, "Data é obrigatória"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface GoalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: any | null;
  onSuccess: () => void;
}

export function GoalEntryDialog({ open, onOpenChange, goal, onSuccess }: GoalEntryDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: 0,
      entry_date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!goal || !user) return;

    setLoading(true);

    // Insert entry
    const { error: entryError } = await supabase.from("goal_entries").insert({
      goal_id: goal.id,
      value: data.value,
      entry_date: data.entry_date,
      notes: data.notes || null,
      created_by: user.id,
    });

    if (entryError) {
      setLoading(false);
      toast({ title: "Erro ao lançar valor", description: entryError.message, variant: "destructive" });
      return;
    }

    // Update goal's current_value
    const newValue = (goal.current_value || 0) + data.value;
    const { error: updateError } = await supabase
      .from("goals")
      .update({ current_value: newValue })
      .eq("id", goal.id);

    setLoading(false);

    if (updateError) {
      toast({ title: "Erro ao atualizar meta", description: updateError.message, variant: "destructive" });
    } else {
      toast({ title: "Valor lançado com sucesso" });
      form.reset();
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar Valor</DialogTitle>
          {goal && (
            <DialogDescription>
              Meta: {goal.name}
              <br />
              Atual: {goal.current_value?.toLocaleString()} / Meta: {goal.target_value?.toLocaleString()}
            </DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor a adicionar</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entry_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do lançamento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações sobre este lançamento..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Lançando..." : "Lançar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
