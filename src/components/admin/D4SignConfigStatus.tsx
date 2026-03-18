import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Plug } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  config: { token_api: string; crypt_key: string };
}

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error';

export function D4SignConfigStatus({ config }: Props) {

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [safes, setSafes] = useState<Array<{ uuid: string; name: string }>>([]);
  const [errorMessage, setErrorMessage] = useState('');

  async function testConnection() {
    if (!config.token_api || !config.crypt_key) {
      toast.error('Preencha Token API e Crypt Key antes de testar');
      return;
    }

    setStatus('testing');
    setErrorMessage('');
    setSafes([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/d4sign-proxy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'list_safes',
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.data?.message || result.error || 'Falha ao conectar com D4Sign');
      }

      const safeList = Array.isArray(result.data)
        ? result.data
        : result.data?.data || [];

      setSafes(safeList);
      setStatus('ok');
      toast.success(`Conexão OK — ${safeList.length} cofre(s) encontrado(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setStatus('error');
      setErrorMessage(msg);
      toast.error(`Falha na conexão: ${msg}`);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4" />
          Status da Conexão D4Sign
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={status === 'testing'}
          >
            {status === 'testing' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plug className="h-4 w-4 mr-2" />
            )}
            {status === 'testing' ? 'Testando...' : 'Testar conexão'}
          </Button>

          {status === 'ok' && (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          )}
          {status === 'error' && (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Falha
            </Badge>
          )}
        </div>

        {status === 'error' && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        {status === 'ok' && safes.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Cofres disponíveis:</p>
            <ul className="space-y-1">
              {safes.map((safe) => (
                <li key={safe.uuid} className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  <span className="font-mono text-xs">{safe.uuid}</span>
                  {safe.name && <span>— {safe.name}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
