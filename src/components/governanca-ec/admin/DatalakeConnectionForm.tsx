import { useEffect, useState } from "react";
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
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.string().min(1, 'Tipo é obrigatório'),
  base_url: z.string().url('URL inválida'),
  auth_type: z.string().min(1, 'Tipo de autenticação é obrigatório'),
  auth_header_name: z.string().optional(),
  token_value: z.string().optional(),
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'api_proxy',
      base_url: '',
      auth_type: 'api_key',
      auth_header_name: 'X-API-Key',
      token_value: '',
      auth_config_json: '{}',
      headers_json: '{}',
    },
  });

  useEffect(() => {
    if (connection) {
      const authHeaderNameFromConfig =
        connection.auth_config_json?.authHeaderName ||
        (connection.auth_type === 'bearer' ? 'Authorization' : 'X-API-Key');

      const tokenFromConfig =
        connection.auth_config_json?.token ||
        connection.auth_config_json?.bearerToken ||
        connection.auth_config_json?.apiKey ||
        connection.auth_config_json?.api_key ||
        connection.headers_json?.[authHeaderNameFromConfig] ||
        connection.headers_json?.['X-API-Key'] ||
        connection.headers_json?.['x-api-key'] ||
        connection.headers_json?.['Authorization'] ||
        '';

      form.reset({
        name: connection.name,
        type: connection.type,
        base_url: connection.base_url,
        auth_type: connection.auth_type || 'api_key',
        auth_header_name: authHeaderNameFromConfig,
        token_value: tokenFromConfig,
        auth_config_json: JSON.stringify(connection.auth_config_json || {}, null, 2),
        headers_json: JSON.stringify(connection.headers_json || {}, null, 2),
      });
    } else {
      form.reset({
        name: '',
        type: 'api_proxy',
        base_url: '',
        auth_type: 'api_key',
        auth_header_name: 'X-API-Key',
        token_value: '',
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

      const authType = data.auth_type;
      const authHeaderName = (data.auth_header_name || '').trim();
      const tokenValue = (data.token_value || '').trim();

      const headersObject = headersConfig as Record<string, any>;
      const authObject = authConfig as Record<string, any>;

      delete headersObject['X-API-Key'];
      delete headersObject['x-api-key'];
      delete headersObject['Authorization'];
      delete authObject.apiKey;
      delete authObject.api_key;
      delete authObject.token;
      delete authObject.bearerToken;

      if (authType === 'bearer' && tokenValue) {
        authConfig = {
          ...authObject,
          token: tokenValue,
          authHeaderName: 'Authorization',
        };
        headersConfig = {
          ...headersObject,
          Authorization: tokenValue.startsWith('Bearer ') ? tokenValue : `Bearer ${tokenValue}`,
        };
      } else if (authType === 'api_key' && tokenValue) {
        const headerName = authHeaderName || 'X-API-Key';
        authConfig = {
          ...authObject,
          apiKey: tokenValue,
          authHeaderName: headerName,
        };
        headersConfig = {
          ...headersObject,
          [headerName]: tokenValue,
        };
      } else {
        authConfig = authObject;
        headersConfig = headersObject;
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

  const testConnection = async () => {
    if (!connection?.id) {
      toast.info('Salve a conexão primeiro para testar');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const firstAttempt = await supabase.functions.invoke('dab-proxy', {
        body: {
          path: 'funcionarios',
          query: { $first: 1 },
          connectionId: connection.id,
        },
      });

      let invokeError = firstAttempt.error;

      if (invokeError) {
        const fallbackAttempt = await supabase.functions.invoke('dab-proxy', {
          body: {
            path: 'funcionarios',
            connectionId: connection.id,
          },
        });
        invokeError = fallbackAttempt.error;
      }

      if (invokeError) throw invokeError;

      setTestResult('success');
      setLastTestedAt(new Date().toLocaleString('pt-BR'));
      toast.success('Conexão ativa');
    } catch (error: any) {
      setTestResult('error');
      let detailsMessage = '';
      try {
        if (error?.context) {
          const details = await error.context.json();
          detailsMessage = details?.details?.error || details?.details?.message || details?.error || '';
        }
      } catch {
        detailsMessage = '';
      }

      const status = error?.context?.status;
      toast.error(
        status
          ? `Falha na conexão (HTTP ${status})${detailsMessage ? ` - ${detailsMessage}` : ''}`
          : (error?.message || 'Falha ao testar conexão'),
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
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

            {testResult && (
              <div className={`rounded-lg border px-4 py-3 ${testResult === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {testResult === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  {testResult === 'success' ? 'Conexão ativa' : 'Conexão indisponível'}
                </div>
                {lastTestedAt && (
                  <p className="text-xs text-muted-foreground mt-1">Última verificação: {lastTestedAt}</p>
                )}
              </div>
            )}

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
                      <SelectItem value="api_key">API Key (Header)</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="none">Sem autenticação</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="auth_header_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Header de Autenticação</FormLabel>
                    <FormControl>
                      <Input placeholder="X-API-Key" {...field} />
                    </FormControl>
                    <FormDescription>
                      Ex: Authorization, X-API-Key
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="token_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token / Chave de API</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Cole a credencial da API"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              <Button type="button" variant="outline" onClick={testConnection} disabled={testing || !connection?.id}>
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Testar Conexão
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Configuração
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
