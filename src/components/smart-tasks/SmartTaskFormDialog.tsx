import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  { value: "draft", label: "Não Iniciado" },
  { value: "active", label: "Em Andamento" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
] as const;

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().min(1, "Nome da tarefa é obrigatório"),
  owner_id: z.string().min(1, "Responsável é obrigatório"),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().min(1, "Data de término é obrigatória"),
  status: z.enum(["draft", "active", "completed", "cancelled"]),
}).refine((d) => d.end_date >= d.start_date, {
  message: "Data de término deve ser igual ou posterior à data de início",
  path: ["end_date"],
});

type FormData = z.infer<typeof formSchema>;

export interface SmartTask {
  id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
  owner?: { first_name: string | null; last_name: string | null } | null;
}

interface SmartTaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: SmartTask | null;
}

type ProfileRow = {
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    is_active: boolean | null;
  } | null;
};

export function SmartTaskFormDialog({
  open,
  onOpenChange,
  task,
}: SmartTaskFormDialogProps) {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
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
      description: "",
      owner_id: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "draft",
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        owner_id: task.owner_id || "",
        start_date: task.start_date,
        end_date: task.end_date,
        status: task.status as FormData["status"],
      });
    } else {
      form.reset({
        title: "",
        description: "",
        owner_id: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "draft",
      });
    }
  }, [task, form, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        title: data.title,
        description: data.description,
        owner_id: data.owner_id,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        level: "individual" as const,
        company_id: selectedCompany?.id,
        created_by: user?.id,
      };

      if (task) {
        const { error } = await supabase
          .from("okr_objectives")
          .update(payload)
          .eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("okr_objectives").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-tasks"] });
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Erro ao salvar tarefa: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarefa SMART" : "Nova Tarefa SMART"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Projeto Comercial Q2" {...field} />
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
                  <FormLabel>Nome da Tarefa *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Revisar carteira Top 20 de clientes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="owner_id"
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
