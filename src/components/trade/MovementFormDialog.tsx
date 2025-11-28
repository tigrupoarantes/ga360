import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { format } from "date-fns";

const movementSchema = z.object({
  industry_id: z.string().min(1, "Selecione uma indústria"),
  material_id: z.string().min(1, "Selecione um material"),
  quantity: z.number().min(1, "Quantidade deve ser maior que zero"),
  company_id: z.string().min(1, "Selecione a empresa destino"),
  movement_date: z.string().min(1, "Selecione a data"),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

type MovementFormValues = z.infer<typeof movementSchema>;

interface MovementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementType: "entrada" | "saida";
}

export function MovementFormDialog({ open, onOpenChange, movementType }: MovementFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>("");
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

  const { data: materials = [] } = useQuery({
    queryKey: ["trade-materials", selectedIndustryId],
    queryFn: async () => {
      if (!selectedIndustryId) return [];
      const { data, error } = await supabase
        .from("trade_materials")
        .select("id, name, category")
        .eq("industry_id", selectedIndustryId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedIndustryId,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      industry_id: "",
      material_id: "",
      quantity: 1,
      company_id: "",
      movement_date: format(new Date(), "yyyy-MM-dd"),
      reference_number: "",
      notes: "",
    },
  });

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "industry_id") {
        setSelectedIndustryId(value.industry_id || "");
        form.setValue("material_id", "");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (values: MovementFormValues) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const quantityValue = movementType === "saida" ? -Math.abs(values.quantity) : Math.abs(values.quantity);

      const { error } = await supabase
        .from("trade_inventory_movements")
        .insert({
          material_id: values.material_id,
          movement_type: movementType,
          quantity: quantityValue,
          company_id: values.company_id,
          movement_date: values.movement_date,
          reference_number: values.reference_number || null,
          notes: values.notes || null,
          created_by: user?.id,
          received_by: user?.id,
        });

      if (error) throw error;

      toast({ 
        title: movementType === "entrada" 
          ? "Entrada registrada com sucesso" 
          : "Saída registrada com sucesso" 
      });

      queryClient.invalidateQueries({ queryKey: ["trade-inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["trade-inventory-balance"] });
      onOpenChange(false);
      form.reset();
      setSelectedIndustryId("");
    } catch (error: any) {
      toast({
        title: "Erro ao registrar movimentação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const Icon = movementType === "entrada" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {movementType === "entrada" ? "Registrar Entrada" : "Registrar Saída"}
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
              name="material_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material *</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={!selectedIndustryId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedIndustryId ? "Selecione o material" : "Selecione uma indústria primeiro"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name} ({material.category})
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
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="movement_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
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
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa {movementType === "entrada" ? "Destino" : "Origem"} *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
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
              name="reference_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da NF / Referência</FormLabel>
                  <FormControl>
                    <Input placeholder="NF-12345" {...field} />
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
                    <Textarea 
                      placeholder="Observações sobre a movimentação..."
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
                {movementType === "entrada" ? "Registrar Entrada" : "Registrar Saída"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
