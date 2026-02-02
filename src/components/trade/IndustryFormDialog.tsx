import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/external-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Building2 } from "lucide-react";

const industrySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cnpj: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email("Email inválido").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  company_id: z.string().min(1, "Selecione uma empresa"),
});

type IndustryFormValues = z.infer<typeof industrySchema>;

interface IndustryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  industry?: {
    id: string;
    name: string;
    cnpj?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    company_id?: string | null;
  };
}

export function IndustryFormDialog({ open, onOpenChange, industry }: IndustryFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const form = useForm<IndustryFormValues>({
    resolver: zodResolver(industrySchema),
    defaultValues: {
      name: industry?.name || "",
      cnpj: industry?.cnpj || "",
      contact_name: industry?.contact_name || "",
      contact_email: industry?.contact_email || "",
      contact_phone: industry?.contact_phone || "",
      company_id: industry?.company_id || "",
    },
  });

  const onSubmit = async (values: IndustryFormValues) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (industry?.id) {
        const { error } = await supabase
          .from("trade_industries")
          .update({
            name: values.name,
            cnpj: values.cnpj || null,
            contact_name: values.contact_name || null,
            contact_email: values.contact_email || null,
            contact_phone: values.contact_phone || null,
            company_id: values.company_id,
          })
          .eq("id", industry.id);
        if (error) throw error;
        toast({ title: "Indústria atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from("trade_industries")
          .insert({
            name: values.name,
            cnpj: values.cnpj || null,
            contact_name: values.contact_name || null,
            contact_email: values.contact_email || null,
            contact_phone: values.contact_phone || null,
            company_id: values.company_id,
            created_by: user?.id,
          });
        if (error) throw error;
        toast({ title: "Indústria cadastrada com sucesso" });
      }

      queryClient.invalidateQueries({ queryKey: ["trade-industries"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar indústria",
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
            <Building2 className="h-5 w-5" />
            {industry ? "Editar Indústria" : "Nova Indústria"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Indústria *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Nestlé Brasil" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input placeholder="00.000.000/0001-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa Recebedora *</FormLabel>
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

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Contato</p>
              
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@empresa.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="+55 11 99999-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {industry ? "Salvar Alterações" : "Cadastrar Indústria"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
