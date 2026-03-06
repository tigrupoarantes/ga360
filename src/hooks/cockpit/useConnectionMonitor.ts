import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'unconfigured';

interface ConnectionMonitorResult {
  status: ConnectionStatus;
  message: string;
  lastCheckedAt: Date | null;
  checkNow: () => void;
}

async function pingDatalake(token: string): Promise<{ success: boolean; message: string }> {
  // 1. Get active connection config from dl_connections
  const { data: dlConnection, error: connError } = await supabase
    .from('dl_connections')
    .select('base_url, auth_type, auth_config_json, headers_json')
    .eq('is_enabled', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connError || !dlConnection) {
    return { success: false, message: 'API não configurada' };
  }

  // Resolve credentials from dl_connections
  const authConfig = dlConnection.auth_config_json || {};
  const headersConfig = dlConnection.headers_json || {};
  const apiKey = authConfig.apiKey || authConfig.api_key || headersConfig['X-API-Key'] || headersConfig['x-api-key'];

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/test-api-connection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      apiBaseUrl: dlConnection.base_url,
      apiKey,
      authType: dlConnection.auth_type,
      authHeader: authConfig.authHeaderName,
      extraHeaders: headersConfig,
    }),
  });

  return await response.json();
}

export function useConnectionMonitor(): ConnectionMonitorResult {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['connection-monitor'],
    queryFn: async (): Promise<{ success: boolean; message: string; checkedAt: string }> => {
      if (!token) return { success: false, message: 'Sessão expirada', checkedAt: new Date().toISOString() };
      const result = await pingDatalake(token);
      return { ...result, checkedAt: new Date().toISOString() };
    },
    refetchInterval: 45_000,
    refetchIntervalInBackground: true,
    staleTime: 20_000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(2000 * (attemptIndex + 1), 10000),
    enabled: !!token,
  });

  let status: ConnectionStatus;
  let message: string;

  if (!token) {
    status = 'unconfigured';
    message = 'Não autenticado';
  } else if (query.isLoading || query.isFetching) {
    status = 'checking';
    message = 'Verificando conexão...';
  } else if (query.data?.success) {
    status = 'connected';
    message = query.data.message;
  } else if (query.data?.message?.includes('não configurada')) {
    status = 'unconfigured';
    message = 'API não configurada';
  } else {
    status = 'disconnected';
    message = query.data?.message || 'Sem conexão com o Datalake';
  }

  const lastCheckedAt = query.data?.checkedAt ? new Date(query.data.checkedAt) : null;

  const checkNow = () => {
    queryClient.invalidateQueries({ queryKey: ['connection-monitor'] });
  };

  return { status, message, lastCheckedAt, checkNow };
}
