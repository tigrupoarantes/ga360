import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
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
  connection_id: z.string().min(1, 'Conexão é obrigatória'),
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  endpoint_path: z.string().min(1, 'Endpoint é obrigatório'),
  method: z.string().min(1, 'Método é obrigatório'),
  params_schema_json: z.string().optional(),
  body_template_json: z.string().optional(),
  outputs_schema_json: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DatalakeQueryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query?: any;
}

export function DatalakeQueryForm({ 
  open, 
  onOpenChange, 
  query 
}: DatalakeQueryFormProps) {
  const queryClient = useQueryClient();

  const { data: connections } = useQuery({
    queryKey: ['dl-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dl_connections')
        .select('*')
        .eq('is_enabled', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      connection_id: '',
      name: '',
      description: '',
      endpoint_path: '',
      method: 'GET',
      params_schema_json: '[]',
      body_template_json: '{}',
      outputs_schema_json: '[]',
    },
  });

  useEffect(() => {
    if (query) {
      form.reset({
        connection_id: query.connection_id,
        name: query.name,
        description: query.description || '',
        endpoint_path: query.endpoint_path,
        method: query.method,
        params_schema_json: JSON.stringify(query.params_schema_json || [], null, 2),
        body_template_json: JSON.stringify(query.body_template_json || {}, null, 2),
        outputs_schema_json: JSON.stringify(query.outputs_schema_json || [], null, 2),
      });
    } else {
      form.reset({
        connection_id: '',
        name: '',
        description: '',
        endpoint_path: '',
        method: 'GET',
        params_schema_json: '[]',
        body_template_json: '{}',
        outputs_schema_json: '[]',
      });
    }
  }, [query, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let paramsSchema = [];
      let bodyTemplate = {};
      let outputsSchema = [];

      try {
        paramsSchema = JSON.parse(data.params_schema_json || '[]');
        bodyTemplate = JSON.parse(data.body_template_json || '{}');
        outputsSchema = JSON.parse(data.outputs_schema_json || '[]');
      } catch (e) {
        throw new Error('JSON inválido');
      }

      const payload = {
        connection_id: data.connection_id,
        name: data.name,
        description: data.description,
        endpoint_path: data.endpoint_path,
        method: data.method,
        params_schema_json: paramsSchema,
        body_template_json: bodyTemplate,
        outputs_schema_json: outputsSchema,
      };

      if (query) {
        const { error } = await supabase
          .from('dl_queries')
          .update(payload)
          .eq('id', query.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dl_queries')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(query ? 'Query atualizada' : 'Query criada');
      queryClient.invalidateQueries({ queryKey: ['dl-queries'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar query');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {query ? 'Editar Query' : 'Nova Query'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="connection_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conexão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conexão" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {connections?.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id}>
                            {conn.name}
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
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Inadimplência Geral" {...field} />
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
                      <Input placeholder="Descrição da query" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endpoint_path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/api/inadimplencia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="params_schema_json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parâmetros (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='[{"name": "empresa", "type": "string", "required": true}]'
                        className="font-mono text-sm"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Schema dos parâmetros que a query aceita
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body_template_json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body Template (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='{"empresa": "{{empresa}}", "competencia": "{{competencia}}"}'
                        className="font-mono text-sm"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Template do body para requisições POST
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="outputs_schema_json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outputs Schema (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='[{"name": "valor_total", "type": "number"}, {"name": "percentual", "type": "percentage"}]'
                        className="font-mono text-sm"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Campos que a query retorna (usado para mapeamento)
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
                  {query ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
