import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

export interface PedidoItem {
  numero_pedido: string;
  sku: string;
  data: string;
  hora_cadastro: string;
  razao_social: string;
  descricao_produto: string;
  qtde_vendida: number;
  preco_unitario_prod: number;
  desconto_aplicado_prod: number;
  situacao_pedido: string;
  nota_fiscal: string;
  cod_vendedor: string;
  nome_vendedor: string;
}

export interface NaoVendaItem {
  cod_cliente: string;
  razao_social: string;
  data: string;
  cod_vendedor: string;
  nome_vendedor: string;
  acao_nao_venda: string;
  motivo_nao_venda: string;
}

interface PaginatedResult<T> {
  items: T[];
  pagination: { page: number; page_size: number; total_items: number; has_more: boolean };
  cached_at: string;
}

interface UsePaginatedParams {
  dataInicio: string;
  dataFim: string;
  page?: number;
  pageSize?: number;
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

export function useCockpitPedidos({
  dataInicio,
  dataFim,
  page = 1,
  pageSize = 50,
  codVendedorFiltro,
}: UsePaginatedParams) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();

  return useQuery<PaginatedResult<PedidoItem>>({
    queryKey: ['cockpit-pedidos', selectedCompanyId, dataInicio, dataFim, page, pageSize, codVendedorFiltro],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      return callEdgeFunction(token, {
        endpoint: 'pedidos',
        company_id: selectedCompanyId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        page,
        page_size: pageSize,
        cod_vendedor_filtro: codVendedorFiltro,
      });
    },
    enabled: !!user?.id && !!selectedCompanyId && !!dataInicio && !!dataFim,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCockpitNaoVendas({
  dataInicio,
  dataFim,
  page = 1,
  pageSize = 50,
  codVendedorFiltro,
}: UsePaginatedParams) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();

  return useQuery<PaginatedResult<NaoVendaItem>>({
    queryKey: ['cockpit-nao-vendas', selectedCompanyId, dataInicio, dataFim, page, pageSize, codVendedorFiltro],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      return callEdgeFunction(token, {
        endpoint: 'nao-vendas',
        company_id: selectedCompanyId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        page,
        page_size: pageSize,
        cod_vendedor_filtro: codVendedorFiltro,
      });
    },
    enabled: !!user?.id && !!selectedCompanyId && !!dataInicio && !!dataFim,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
