import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const statusOptions = [
  { value: "nao_iniciado", label: "Não Iniciado" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "atrasado", label: "Atrasado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

const formSchema = z.object({
  title: z.string().min(1, "Nome da tarefa é obrigatório"),
  assignee_id: z.string().min(1, "Responsável é obrigatório"),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().min(1, "Data de término é obrigatória"),
  status: z.enum(["nao_iniciado", "em_andamento", "concluido", "atrasado", "cancelado"]),
}).refine((d) => d.end_date >= d.start_date, {
  message: "Data de término deve ser igual ou posterior à data de início",
  path: ["end_date"],
});

type FormData = z.infer<typeof formSchema>;

export interface TaskData {
  id: string;
  title: string;
  assignee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  assignee?: { first_name: string | null; last_name: string | null } | null;
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionPlanId: string;
  objectiveId: string;
  task?: TaskData | null;
}

type ProfileRow = {
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    is_active: boolean | null;
  } | null;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  actionPlanId,
  objectiveId,
  task,
}: TaskFormDialogProps) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-by-company", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_companies")
        .select("profiles!inner(id, first_name, last_name, is_active)")
        .eq("company_id", selectedCompany?.id);
      if (error) throw error;
      return ((data ?? []) as unknown as ProfileRow[])
        .map((row) => row.profiles)
        .filter((p): p is NonNullable<ProfileRow["profiles"]> => !!p && !!p.is_active)
        .map((p) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name }));
    },
    enabled: open && !!selectedCompany?.id,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      assignee_id: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "nao_iniciado",
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        assignee_id: task.assignee_id,
        start_date: task.start_date,
        end_date: task.end_date,
        status: task.status as FormData["status"],
      });
    } else {
      form.reset({
        title: "",
        assignee_id: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "nao_iniciado",
      });
    }
  }, [task, form, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        action_plan_id: actionPlanId,
        title: data.title,
        assignee_id: data.assignee_id,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        created_by: user?.id,
      };

      if (task) {
        const { error } = await supabase
          .from("okr_action_tasks")
          .update(payload)
          .eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("okr_action_tasks").insert(payload);
        if (error) throw error;
      }

      // Recalculate plan progress
      const { data: allTasks } = await supabase
        .from("okr_action_tasks")
        .select("status")
        .eq("action_plan_id", actionPlanId);

      if (allTasks && allTasks.length > 0) {
        const done = allTasks.filter((t) => t.status === "concluido").length;
        const progress = Math.round((done / allTasks.length) * 100);
        await supabase
          .from("okr_objectives")
          .update({ progress })
          .eq("id", objectiveId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-plans"] });
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Erro ao salvar tarefa: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Tarefa *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Realizar 3 cotações de troca de lâmpadas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar responsável" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
