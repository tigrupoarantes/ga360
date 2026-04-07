import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const formSchema = z.object({
  title: z.string().min(1, "Título da ação é obrigatório"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ActionPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  actionPlan?: { id: string; title: string; description?: string | null };
}

export function ActionPlanFormDialog({
  open,
  onOpenChange,
  objectiveId,
  actionPlan,
}: ActionPlanFormDialogProps) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: actionPlan?.title ?? "",
      description: actionPlan?.description ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (actionPlan) {
        const { error } = await supabase
          .from("okr_action_plans")
          .update({ title: data.title, description: data.description || null })
          .eq("id", actionPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("okr_action_plans").insert({
          objective_id: objectiveId,
          company_id: selectedCompany?.id,
          title: data.title,
          description: data.description || null,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okr-action-plans", objectiveId] });
      toast.success(actionPlan ? "Ação atualizada" : "Ação criada");
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) => toast.error("Erro ao salvar ação: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{actionPlan ? "Editar Ação" : "Nova Ação"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da Ação</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Aumentar cobertura de PDVs na região Sul" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Contexto, causa raiz ou objetivo SMART desta ação..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
