import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/external-client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ChecklistEditor } from "./ChecklistEditor";
import { ResponsiblesSelector } from "./ResponsiblesSelector";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  frequency: z.string().min(1, "Frequência é obrigatória"),
  area_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface ChecklistItem {
  id?: string;
  text: string;
  is_required: boolean;
  order_index: number;
}

interface ProcessFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: any | null;
  onSuccess: () => void;
}

export function ProcessFormDialog({ open, onOpenChange, process, onSuccess }: ProcessFormDialogProps) {
  const { selectedCompanyId } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [areas, setAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      frequency: "weekly",
      is_active: true,
    },
  });

  useEffect(() => {
    if (!selectedCompanyId) return;

    const fetchAreas = async () => {
      const { data } = await supabase
        .from("areas")
        .select("*")
        .eq("company_id", selectedCompanyId);
      if (data) setAreas(data);
    };

    fetchAreas();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (process) {
      form.reset({
        name: process.name,
        description: process.description || "",
        frequency: process.frequency,
        area_id: process.area_id || undefined,
        is_active: process.is_active,
      });

      // Load checklist items
      const loadChecklistItems = async () => {
        const { data } = await supabase
          .from("process_checklist_items")
          .select("*")
          .eq("process_id", process.id)
          .order("order_index");
        if (data) {
          setChecklistItems(data.map(item => ({
            id: item.id,
            text: item.text,
            is_required: item.is_required,
            order_index: item.order_index,
          })));
        }
      };

      // Load responsibles
      const loadResponsibles = async () => {
        const { data } = await supabase
          .from("process_responsibles")
          .select("user_id")
          .eq("process_id", process.id);
        if (data) {
          setSelectedResponsibles(data.map(r => r.user_id));
        }
      };

      loadChecklistItems();
      loadResponsibles();
    } else {
      form.reset({
        name: "",
        description: "",
        frequency: "weekly",
        is_active: true,
      });
      setChecklistItems([]);
      setSelectedResponsibles([]);
    }
  }, [process, form]);

  const onSubmit = async (data: FormData) => {
    if (!selectedCompanyId || !user) return;

    setLoading(true);

    const payload = {
      name: data.name,
      description: data.description || null,
      frequency: data.frequency,
      area_id: data.area_id || null,
      is_active: data.is_active,
      company_id: selectedCompanyId,
    };

    let processId = process?.id;
    let error;

    if (process) {
      ({ error } = await supabase.from("processes").update(payload).eq("id", process.id));
    } else {
      const result = await supabase.from("processes").insert([{ ...payload, created_by: user.id }]).select().single();
      error = result.error;
      processId = result.data?.id;
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Save checklist items
    if (processId) {
      // Delete existing items if editing
      if (process) {
        await supabase.from("process_checklist_items").delete().eq("process_id", processId);
      }

      // Insert new items
      if (checklistItems.length > 0) {
        const items = checklistItems.map((item, index) => ({
          process_id: processId,
          text: item.text,
          is_required: item.is_required,
          order_index: index,
        }));
        await supabase.from("process_checklist_items").insert(items);
      }

      // Save responsibles
      if (process) {
        await supabase.from("process_responsibles").delete().eq("process_id", processId);
      }

      if (selectedResponsibles.length > 0) {
        const responsibles = selectedResponsibles.map(userId => ({
          process_id: processId,
          user_id: userId,
        }));
        await supabase.from("process_responsibles").insert(responsibles);
      }
    }

    setLoading(false);
    toast({ title: process ? "Processo atualizado" : "Processo criado com sucesso" });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{process ? "Editar Processo" : "Novo Processo"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Processo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Fechamento Mensal" {...field} />
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
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva o processo..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Diária</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="biweekly">Quinzenal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {areas.map(area => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-base">Ativo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Processos inativos não aparecem na lista de execução
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Responsáveis</label>
                <ResponsiblesSelector
                  selectedIds={selectedResponsibles}
                  onChange={setSelectedResponsibles}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Checklist</label>
                <ChecklistEditor
                  items={checklistItems}
                  onChange={setChecklistItems}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : process ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
