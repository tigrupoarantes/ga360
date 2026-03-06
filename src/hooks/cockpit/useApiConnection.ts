import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { DlConnection } from '@/lib/cockpit-types';

interface UseApiConnectionReturn {
  connection: DlConnection | null;
  isLoading: boolean;
  error: string | null;
  saveConnection: (data: Partial<DlConnection>) => Promise<void>;
  testConnection: (data: Partial<DlConnection>) => Promise<{ success: boolean; message: string }>;
  refetch: () => void;
}

export function useApiConnection(): UseApiConnectionReturn {
  const { session } = useAuth();
  const [connection, setConnection] = useState<DlConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('dl_connections')
        .select('*')
        .eq('is_enabled', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching dl_connection:', fetchError);
        setError('Erro ao carregar configuração de API');
      } else if (data) {
        setConnection({
          id: data.id,
          companyId: data.company_id,
          name: data.name,
          baseUrl: data.base_url,
          authType: data.auth_type,
          authConfigJson: data.auth_config_json || {},
          headersJson: data.headers_json || {},
          isEnabled: data.is_enabled,
          lastSyncAt: data.last_sync_at,
          lastSyncStatus: data.last_sync_status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
    } catch (err) {
      console.error('Error fetching dl_connection:', err);
      setError('Erro ao carregar configuração de API');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection();
  }, []);

  const saveConnection = async (data: Partial<DlConnection>) => {
    // Build auth_config_json from the connection form fields
    const authConfigJson: Record<string, string> = {
      ...data.authConfigJson,
    };

    const headersJson: Record<string, string> = {
      ...data.headersJson,
    };

    const payload = {
      name: data.name || 'Datalake Principal',
      base_url: data.baseUrl,
      auth_type: data.authType,
      auth_config_json: authConfigJson,
      headers_json: headersJson,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    };

    if (connection?.id) {
      const { error: updateError } = await supabase
        .from('dl_connections')
        .update(payload)
        .eq('id', connection.id);

      if (updateError) {
        console.error('Error updating dl_connection:', updateError);
        throw new Error('Erro ao salvar configuração');
      }
    } else {
      const { error: insertError } = await supabase
        .from('dl_connections')
        .insert(payload);

      if (insertError) {
        console.error('Error inserting dl_connection:', insertError);
        throw new Error('Erro ao salvar configuração');
      }
    }

    await fetchConnection();
  };

  const testConnection = async (data: Partial<DlConnection>): Promise<{ success: boolean; message: string }> => {
    if (!data.baseUrl) return { success: false, message: 'URL da API não informada' };

    try {
      const token = session?.access_token;
      if (!token) return { success: false, message: 'Sessão expirada. Faça login novamente.' };

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Resolve apiKey from authConfigJson for the test call
      const authConfig = data.authConfigJson || {};
      const headersConfig = data.headersJson || {};
      const apiKey = authConfig.apiKey || authConfig.api_key || headersConfig['X-API-Key'] || headersConfig['x-api-key'];

      const response = await fetch(`${supabaseUrl}/functions/v1/test-api-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          apiBaseUrl: data.baseUrl,
          apiKey,
          authType: data.authType,
          authHeader: authConfig.authHeaderName,
          extraHeaders: headersConfig,
        }),
      });

      const result = await response.json();

      // Update sync status on dl_connections
      if (connection?.id) {
        await supabase
          .from('dl_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: result.success ? 'success' : 'error',
          })
          .eq('id', connection.id);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      return { success: false, message: `Erro: ${message}` };
    }
  };

  return { connection, isLoading, error, saveConnection, testConnection, refetch: fetchConnection };
}
