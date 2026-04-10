import { useEffect, useState, useMemo } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

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
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  // Query profiles: buscar user_ids da empresa, depois nomes em profiles
  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles-by-company-v2", selectedCompany?.id],
    queryFn: async () => {
      // Step 1: get user_ids from user_companies
      const { data: ucRows, error: ucError } = await supabase
        .from("user_companies")
        .select("user_id")
        .eq("company_id", selectedCompany?.id);
      if (ucError) throw ucError;

      const userIds = (ucRows ?? []).map((r) => r.user_id).filter(Boolean);
      if (userIds.length === 0) return [];

      // Step 2: get profiles for those user_ids
      const { data: profileRows, error: profError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, is_active")
        .in("id", userIds)
        .eq("is_active", true);
      if (profError) throw profError;

      return (profileRows ?? []).map((p) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
      }));
    },
    enabled: open && !!selectedCompany?.id,
  });

  // Filter profiles by search
  const filteredProfiles = useMemo(() => {
    if (!assigneeSearch.trim()) return profiles;
    const term = assigneeSearch.toLowerCase();
    return profiles.filter((p) => {
      const fullName = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
      return fullName.includes(term);
    });
  }, [profiles, assigneeSearch]);

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
    setAssigneeSearch("");
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

  const selectedProfile = profiles.find((p) => p.id === form.watch("assignee_id"));

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

            {/* Responsável com busca por nome */}
            <FormField
              control={form.control}
              name="assignee_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Responsável *</FormLabel>
                  <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {selectedProfile
                            ? `${selectedProfile.first_name || ""} ${selectedProfile.last_name || ""}`.trim()
                            : "Buscar responsável..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="flex items-center gap-2 px-3 py-2 border-b">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          placeholder="Buscar por nome..."
                          value={assigneeSearch}
                          onChange={(e) => setAssigneeSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1">
                        {filteredProfiles.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum colaborador encontrado
                          </p>
                        ) : (
                          filteredProfiles.map((p) => {
                            const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
                            const isSelected = field.value === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                className={cn(
                                  "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                                  isSelected && "bg-accent"
                                )}
                                onClick={() => {
                                  field.onChange(p.id);
                                  setAssigneeOpen(false);
                                  setAssigneeSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    isSelected ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
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
