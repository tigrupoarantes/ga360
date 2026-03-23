import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { D4SignConfigStatus } from './D4SignConfigStatus';

interface D4SignConfig {
  token_api: string;
  crypt_key: string;
  safe_id: string;
  environment: 'sandbox' | 'production';
  base_url: string;
  webhook_url: string;
  is_active: boolean;
}

const ENV_URLS: Record<string, string> = {
  sandbox: 'https://sandbox.d4sign.com.br/api/v1',
  production: 'https://secure.d4sign.com.br/api/v1',
};

export function D4SignConfigForm() {
  const queryClient = useQueryClient();
  const [showTokenApi, setShowTokenApi] = useState(false);
  const [showCryptKey, setShowCryptKey] = useState(false);

  const [form, setForm] = useState<D4SignConfig>({
    token_api: '',
    crypt_key: '',
    safe_id: '',
    environment: 'sandbox',
    base_url: ENV_URLS.sandbox,
    webhook_url: '',
    is_active: true,
  });

  // Carrega configuração existente ao montar
  const { data: savedConfig } = useQuery({
    queryKey: ['d4sign-config-global'],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return null;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-d4sign-config`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return null;
      const json = await res.json();
      return json.config ?? null;
    },
    staleTime: 5 * 60_000,
  });

  // Pré-preenche campos não-sensíveis quando config é carregada
  useEffect(() => {
    if (!savedConfig) return;
    setForm((prev) => ({
      ...prev,
      safe_id: savedConfig.safe_id ?? prev.safe_id,
      environment: savedConfig.environment ?? prev.environment,
      base_url: savedConfig.base_url ?? prev.base_url,
      webhook_url: savedConfig.webhook_url ?? prev.webhook_url,
    }));
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: async (data: D4SignConfig) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-d4sign-config`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ config: data }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar configuração');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Configuração D4Sign salva com sucesso');
      queryClient.invalidateQueries({ queryKey: ['d4sign-config-global'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  function handleEnvironmentChange(env: string) {
    setForm((prev) => ({
      ...prev,
      environment: env as 'sandbox' | 'production',
      base_url: ENV_URLS[env] ?? prev.base_url,
    }));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais D4Sign</CardTitle>
          <CardDescription>
            Configuração global — as mesmas credenciais são usadas para todas as empresas.
            Obtenha o Token API e a Crypt Key no painel D4Sign em{' '}
            <span className="font-mono text-xs">Configurações → Integrações → API</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="environment">Ambiente</Label>
              <Select value={form.environment} onValueChange={handleEnvironmentChange}>
                <SelectTrigger id="environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="safe_id">ID do Cofre (Safe UUID)</Label>
              <Input
                id="safe_id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={form.safe_id}
                onChange={(e) => setForm((p) => ({ ...p, safe_id: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="token_api">Token API</Label>
              {savedConfig?.configured && !form.token_api && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Salvo: {savedConfig.token_api_masked}
                </Badge>
              )}
            </div>
            <div className="relative">
              <Input
                id="token_api"
                type={showTokenApi ? 'text' : 'password'}
                placeholder={savedConfig?.configured ? 'Deixe em branco para manter o atual' : 'Seu tokenAPI da D4Sign'}
                value={form.token_api}
                onChange={(e) => setForm((p) => ({ ...p, token_api: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowTokenApi((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showTokenApi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="crypt_key">Crypt Key</Label>
              {savedConfig?.configured && !form.crypt_key && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Salvo: {savedConfig.crypt_key_masked}
                </Badge>
              )}
            </div>
            <div className="relative">
              <Input
                id="crypt_key"
                type={showCryptKey ? 'text' : 'password'}
                placeholder={savedConfig?.configured ? 'Deixe em branco para manter o atual' : 'Sua cryptKey da D4Sign'}
                value={form.crypt_key}
                onChange={(e) => setForm((p) => ({ ...p, crypt_key: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCryptKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCryptKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="webhook_url">URL do Webhook</Label>
            <Input
              id="webhook_url"
              placeholder="https://seu-projeto.supabase.co/functions/v1/d4sign-webhook"
              value={form.webhook_url}
              onChange={(e) => setForm((p) => ({ ...p, webhook_url: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              URL que a D4Sign usará para notificar assinaturas concluídas.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.token_api || !form.crypt_key}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar configuração'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <D4SignConfigStatus config={form} />
    </div>
  );
}
