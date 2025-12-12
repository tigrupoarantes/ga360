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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  unit: z.string().optional(),
  calculation_type: z.string().default("sum"),
});

type FormData = z.infer<typeof formSchema>;

interface GoalTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalType: any | null;
  onSuccess: () => void;
}

export function GoalTypeFormDialog({ open, onOpenChange, goalType, onSuccess }: GoalTypeFormDialogProps) {
  const { selectedCompanyId } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "",
      calculation_type: "sum",
    },
  });

  useEffect(() => {
    if (goalType) {
      form.reset({
        name: goalType.name,
        description: goalType.description || "",
        unit: goalType.unit || "",
        calculation_type: goalType.calculation_type,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        unit: "",
        calculation_type: "sum",
      });
    }
  }, [goalType, form]);

  const onSubmit = async (data: FormData) => {
    if (!selectedCompanyId || !user) return;

    setLoading(true);

    const payload = {
      ...data,
      company_id: selectedCompanyId,
      description: data.description || null,
      unit: data.unit || null,
    };

    let error;
    if (goalType) {
      ({ error } = await supabase.from("goal_types").update(payload).eq("id", goalType.id));
    } else {
      ({ error } = await supabase.from("goal_types").insert([{ ...payload, created_by: user.id }]));
    }

    setLoading(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: goalType ? "Tipo atualizado" : "Tipo criado com sucesso" });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{goalType ? "Editar Tipo de Meta" : "Novo Tipo de Meta"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Faturamento, NPS, Market Share" {...field} />
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
                    <Textarea placeholder="Descrição do tipo de meta..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade de Medida</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: R$, %, unidades, kg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="calculation_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cálculo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sum">Soma (acumulativo)</SelectItem>
                      <SelectItem value="avg">Média</SelectItem>
                      <SelectItem value="last">Último valor</SelectItem>
                      <SelectItem value="max">Valor máximo</SelectItem>
                      <SelectItem value="min">Valor mínimo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : goalType ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
