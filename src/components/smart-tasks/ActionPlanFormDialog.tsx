import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
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
import { useEmployees } from "./useEmployees";
import { EmployeeCombobox } from "./EmployeeCombobox";

const formSchema = z.object({
  title: z.string().min(1, "Título / objetivo é obrigatório"),
  description: z.string().optional(),
  owner_id: z.string().min(1, "Responsável é obrigatório"),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().min(1, "Data de término é obrigatória"),
}).refine((d) => d.end_date >= d.start_date, {
  message: "Data de término deve ser igual ou posterior à data de início",
  path: ["end_date"],
});

type FormData = z.infer<typeof formSchema>;

export interface ActionPlanData {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  progress: number | null;
  owner_id: string | null;
  owner_name?: string | null;
  defaultPlanId?: string;
}

interface ActionPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: ActionPlanData | null;
}

export function ActionPlanFormDialog({
  open,
  onOpenChange,
  plan,
}: ActionPlanFormDialogProps) {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: employees = [] } = useEmployees(open);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      owner_id: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (plan) {
      form.reset({
        title: plan.title,
        description: plan.description || "",
        owner_id: plan.owner_id || "",
        start_date: plan.start_date,
        end_date: plan.end_date,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        owner_id: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });
    }
  }, [plan, form, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (plan) {
        const { error } = await supabase
          .from("okr_objectives")
          .update({
            title: data.title,
            description: data.description || null,
            owner_id: data.owner_id,
            start_date: data.start_date,
            end_date: data.end_date,
          })
          .eq("id", plan.id);
        if (error) throw error;
      } else {
        // Create objective
        const { data: objective, error: objError } = await supabase
          .from("okr_objectives")
          .insert({
            title: data.title,
            description: data.description || null,
            owner_id: data.owner_id,
            start_date: data.start_date,
            end_date: data.end_date,
            status: "active",
            level: "company",
            company_id: selectedCompany?.id,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (objError) throw objError;

        // Create default bridge action_plan
        const { error: planError } = await supabase
          .from("okr_action_plans")
          .insert({
            objective_id: objective.id,
            title: "Tarefas",
            company_id: selectedCompany?.id,
            created_by: user?.id,
          });
        if (planError) throw planError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-plans"] });
      toast.success(plan ? "Plano atualizado" : "Plano criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Erro ao salvar plano: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Editar Plano de Ação" : "Novo Plano de Ação"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título / Objetivo *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Reduzir custos com pintura da igreja em 50% até junho de 2026"
                      {...field}
                    />
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
                    <Textarea placeholder="Detalhes do plano de ação..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="owner_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Responsável Macro *</FormLabel>
                  <FormControl>
                    <EmployeeCombobox
                      employees={employees}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Início *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Fim *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
