import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/external-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";

const MATERIAL_CATEGORIES = [
  { value: "display", label: "Display" },
  { value: "banner", label: "Banner" },
  { value: "wobbler", label: "Wobbler" },
  { value: "faixa", label: "Faixa de Gôndola" },
  { value: "totem", label: "Totem" },
  { value: "adesivo", label: "Adesivo" },
  { value: "stopper", label: "Stopper" },
  { value: "testeira", label: "Testeira" },
  { value: "outro", label: "Outro" },
];

const UNITS = [
  { value: "unidade", label: "Unidade" },
  { value: "pacote", label: "Pacote" },
  { value: "caixa", label: "Caixa" },
  { value: "kit", label: "Kit" },
  { value: "metro", label: "Metro" },
];

const materialSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional(),
  category: z.string().min(1, "Selecione uma categoria"),
  industry_id: z.string().min(1, "Selecione uma indústria"),
  unit: z.string().min(1, "Selecione uma unidade"),
});

type MaterialFormValues = z.infer<typeof materialSchema>;

interface MaterialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: {
    id: string;
    name: string;
    description?: string | null;
    category: string;
    industry_id?: string | null;
    unit?: string | null;
  };
  preselectedIndustryId?: string;
}

export function MaterialFormDialog({ open, onOpenChange, material, preselectedIndustryId }: MaterialFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: industries = [] } = useQuery({
    queryKey: ["trade-industries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_industries")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: material?.name || "",
      description: material?.description || "",
      category: material?.category || "",
      industry_id: material?.industry_id || preselectedIndustryId || "",
      unit: material?.unit || "unidade",
    },
  });

  const onSubmit = async (values: MaterialFormValues) => {
    setIsLoading(true);
    try {
      if (material?.id) {
        const { error } = await supabase
          .from("trade_materials")
          .update({
            name: values.name,
            description: values.description || null,
            category: values.category,
            industry_id: values.industry_id,
            unit: values.unit,
          })
          .eq("id", material.id);
        if (error) throw error;
        toast({ title: "Material atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("trade_materials")
          .insert({
            name: values.name,
            description: values.description || null,
            category: values.category,
            industry_id: values.industry_id,
            unit: values.unit,
          });
        if (error) throw error;
        toast({ title: "Material cadastrado com sucesso" });
      }

      queryClient.invalidateQueries({ queryKey: ["trade-materials"] });
      queryClient.invalidateQueries({ queryKey: ["trade-inventory-balance"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar material",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {material ? "Editar Material" : "Novo Material de Merchandising"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="industry_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Indústria *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a indústria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry.id} value={industry.id}>
                          {industry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Material *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Display de Chão 1.80m" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MATERIAL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Textarea 
                      placeholder="Descrição detalhada do material..."
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {material ? "Salvar Alterações" : "Cadastrar Material"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
