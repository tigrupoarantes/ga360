import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.string().min(1, 'Tipo é obrigatório'),
  base_url: z.string().url('URL inválida'),
  auth_type: z.string().min(1, 'Tipo de autenticação é obrigatório'),
  api_key: z.string().optional(),
  auth_config_json: z.string().optional(),
  headers_json: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DatalakeConnectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection?: any;
}

export function DatalakeConnectionForm({ 
  open, 
  onOpenChange, 
  connection 
}: DatalakeConnectionFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'api_proxy',
      base_url: '',
      auth_type: 'bearer',
      api_key: '',
      auth_config_json: '{}',
      headers_json: '{}',
    },
  });

  useEffect(() => {
    if (connection) {
      const apiKeyFromConfig =
        connection.auth_config_json?.apiKey ||
        connection.auth_config_json?.api_key ||
        connection.headers_json?.['X-API-Key'] ||
        connection.headers_json?.['x-api-key'] ||
        '';

      form.reset({
        name: connection.name,
        type: connection.type,
        base_url: connection.base_url,
        auth_type: connection.auth_type,
        api_key: apiKeyFromConfig,
        auth_config_json: JSON.stringify(connection.auth_config_json || {}, null, 2),
        headers_json: JSON.stringify(connection.headers_json || {}, null, 2),
      });
    } else {
      form.reset({
        name: '',
        type: 'api_proxy',
        base_url: '',
        auth_type: 'bearer',
        api_key: '',
        auth_config_json: '{}',
        headers_json: '{}',
      });
    }
  }, [connection, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let authConfig = {};
      let headersConfig = {};

      try {
        authConfig = JSON.parse(data.auth_config_json || '{}');
        headersConfig = JSON.parse(data.headers_json || '{}');
      } catch (e) {
        throw new Error('JSON inválido');
      }

      const apiKey = data.api_key?.trim();
      if (apiKey) {
        authConfig = {
          ...authConfig,
          apiKey,
        };
        headersConfig = {
          ...headersConfig,
          "X-API-Key": apiKey,
        };
      } else {
        const { apiKey: _apiKey, api_key: _legacyApiKey, ...restAuthConfig } = authConfig as Record<string, any>;
        const { "X-API-Key": _xApiKey, "x-api-key": _xApiKeyLower, ...restHeadersConfig } = headersConfig as Record<string, any>;
        authConfig = restAuthConfig;
        headersConfig = restHeadersConfig;
      }

      const payload = {
        name: data.name,
        type: data.type,
        base_url: data.base_url,
        auth_type: data.auth_type,
        auth_config_json: authConfig,
        headers_json: headersConfig,
        created_by: user?.id,
      };

      if (connection) {
        const { error } = await supabase
          .from('dl_connections')
          .update(payload)
          .eq('id', connection.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dl_connections')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(connection ? 'Conexão atualizada' : 'Conexão criada');
      queryClient.invalidateQueries({ queryKey: ['dl-connections'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar conexão');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {connection ? 'Editar Conexão' : 'Nova Conexão'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="API Datalake Principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sql_server_proxy">SQL Server (via API Proxy)</SelectItem>
                      <SelectItem value="api_proxy">API Proxy Genérico</SelectItem>
                      <SelectItem value="rest_api">REST API</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="base_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Base</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.exemplo.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    URL base do servidor de API Proxy
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auth_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Autenticação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="none">Sem autenticação</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Cole a credencial da API"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Campo direto para autenticação da API (salvo em headers/config para uso no proxy).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auth_config_json"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Configuração de Autenticação (JSON)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder='{"token": "seu-token-aqui"}'
                      className="font-mono text-sm"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Ex: {"{"}"token": "xxx"{"}"} para Bearer, {"{"}"api_key": "xxx"{"}"} para API Key
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="headers_json"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headers Adicionais (JSON)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder='{"X-Custom-Header": "valor"}'
                      className="font-mono text-sm"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
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
                {connection ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
