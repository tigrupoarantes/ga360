import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  card_id: z.string().min(1, 'Card é obrigatório'),
  query_id: z.string().min(1, 'Query é obrigatória'),
  refresh_policy: z.string().min(1, 'Política de atualização é obrigatória'),
  cache_ttl_minutes: z.coerce.number().min(1).max(1440),
  mapping_json: z.string().optional(),
  params_mapping_json: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DatalakeBindingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binding?: any;
}

export function DatalakeBindingForm({ 
  open, 
  onOpenChange, 
  binding 
}: DatalakeBindingFormProps) {
  const queryClient = useQueryClient();

  const { data: cards } = useQuery({
    queryKey: ['ec-cards-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_cards')
        .select('id, title, area:ec_areas(name)')
        .eq('is_active', true)
        .order('title');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: queries } = useQuery({
    queryKey: ['dl-queries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dl_queries')
        .select('id, name, endpoint_path')
        .eq('is_enabled', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      card_id: '',
      query_id: '',
      refresh_policy: 'manual',
      cache_ttl_minutes: 60,
      mapping_json: '[]',
      params_mapping_json: '{}',
    },
  });

  useEffect(() => {
    if (binding) {
      form.reset({
        card_id: binding.card_id,
        query_id: binding.query_id,
        refresh_policy: binding.refresh_policy,
        cache_ttl_minutes: binding.cache_ttl_minutes,
        mapping_json: JSON.stringify(binding.mapping_json || [], null, 2),
        params_mapping_json: JSON.stringify(binding.params_mapping_json || {}, null, 2),
      });
    } else {
      form.reset({
        card_id: '',
        query_id: '',
        refresh_policy: 'manual',
        cache_ttl_minutes: 60,
        mapping_json: '[]',
        params_mapping_json: '{}',
      });
    }
  }, [binding, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let mapping = [];
      let paramsMapping = {};

      try {
        mapping = JSON.parse(data.mapping_json || '[]');
        paramsMapping = JSON.parse(data.params_mapping_json || '{}');
      } catch (e) {
        throw new Error('JSON inválido');
      }

      const payload = {
        card_id: data.card_id,
        query_id: data.query_id,
        refresh_policy: data.refresh_policy,
        cache_ttl_minutes: data.cache_ttl_minutes,
        mapping_json: mapping,
        params_mapping_json: paramsMapping,
      };

      if (binding) {
        const { error } = await supabase
          .from('dl_card_bindings')
          .update(payload)
          .eq('id', binding.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dl_card_bindings')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(binding ? 'Vínculo atualizado' : 'Vínculo criado');
      queryClient.invalidateQueries({ queryKey: ['dl-bindings'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar vínculo');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {binding ? 'Editar Vínculo' : 'Novo Vínculo'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="card_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o card" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cards?.map((card: any) => (
                          <SelectItem key={card.id} value={card.id}>
                            {card.area?.name} → {card.title}
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
                name="query_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Query</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a query" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {queries?.map((query) => (
                          <SelectItem key={query.id} value={query.id}>
                            {query.name} ({query.endpoint_path})
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
                  name="refresh_policy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Política de Atualização</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="hourly">A cada hora</SelectItem>
                          <SelectItem value="daily">Diário</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cache_ttl_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cache TTL (minutos)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={1440} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="mapping_json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mapeamento de Outputs (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='[{"output_field": "valor_total", "label": "Valor Total", "format": "currency"}]'
                        className="font-mono text-sm"
                        rows={4}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Define quais campos da query exibir e como formatá-los
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="params_mapping_json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mapeamento de Parâmetros (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='{"empresa": "{{card.scope.empresa}}", "competencia": "{{record.competence}}"}'
                        className="font-mono text-sm"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Como preencher os parâmetros da query
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {binding ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
