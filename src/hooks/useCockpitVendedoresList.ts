import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export interface VendedorItem {
  cod: string;
  nome: string;
}

export function useCockpitVendedoresList() {
  const { selectedCompanyId } = useCompany();

  return useQuery<VendedorItem[]>({
    queryKey: ['cockpit-vendedores-lista', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_employees')
        .select('cod_vendedor, full_name')
        .eq('company_id', selectedCompanyId!)
        .eq('is_active', true)
        .not('cod_vendedor', 'is', null)
        .neq('cod_vendedor', '')
        .order('full_name');

      if (error) throw error;
      return (data ?? []).map((e) => ({ cod: e.cod_vendedor!, nome: e.full_name }));
    },
    enabled: !!selectedCompanyId,
    staleTime: 10 * 60 * 1000,
  });
}
