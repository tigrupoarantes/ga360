import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

export interface CockpitKpis {
  faturamento_total: number;
  total_pedidos: number;
  ticket_medio: number;
  clientes_visitados: number;
  cobertura_pct: number | null;
  nao_vendas: number;
}

export interface CockpitKpisResult {
  kpis: CockpitKpis;
  cached_at: string;
  fonte?: 'sync' | 'dab';
  sync_pending?: boolean;
}

interface UseCockpitKpisParams {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  codVendedorFiltro?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFunction(token: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cockpit-vendas-query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (data.error) throw new Error(data.error);
  return data;
}

export function useCockpitKpis({ dataInicio, dataFim, codVendedorFiltro }: UseCockpitKpisParams) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();

  return useQuery<CockpitKpisResult>({
    queryKey: ['cockpit-kpis', selectedCompanyId, dataInicio, dataFim, codVendedorFiltro],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      return callEdgeFunction(token, {
        endpoint: 'kpis',
        company_id: selectedCompanyId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        cod_vendedor_filtro: codVendedorFiltro,
      });
    },
    enabled: !!user?.id && !!selectedCompanyId && !!dataInicio && !!dataFim,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCockpitRanking({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();

  return useQuery({
    queryKey: ['cockpit-ranking', selectedCompanyId, dataInicio, dataFim],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      return callEdgeFunction(token, {
        endpoint: 'ranking',
        company_id: selectedCompanyId,
        data_inicio: dataInicio,
        data_fim: dataFim,
      });
    },
    enabled: !!user?.id && !!selectedCompanyId && !!dataInicio && !!dataFim,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
