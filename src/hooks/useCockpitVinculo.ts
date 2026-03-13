import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

export type NivelAcesso = 'vendedor' | 'supervisor' | 'gerente' | 'diretoria';

export interface CockpitVinculo {
  id: string;
  user_id: string;
  company_id: string;
  cod_vendedor: string;
  nivel_acesso: NivelAcesso;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const ADMIN_ROLES = ['super_admin', 'ceo'];

export function useCockpitVinculo() {
  const { user, role } = useAuth();
  const { selectedCompanyId } = useCompany();

  // super_admin e ceo têm acesso total sem precisar de vínculo
  const isAdmin = ADMIN_ROLES.includes(role ?? '');

  const { data: vinculo, isLoading, error } = useQuery({
    queryKey: ['cockpit-vinculo', user?.id, selectedCompanyId],
    queryFn: async () => {
      if (isAdmin) {
        // Retorna vínculo sintético com escopo máximo
        return {
          id: 'admin',
          user_id: user!.id,
          company_id: selectedCompanyId!,
          cod_vendedor: '',
          nivel_acesso: 'diretoria' as NivelAcesso,
          ativo: true,
          created_at: '',
          updated_at: '',
        } satisfies CockpitVinculo;
      }
      const { data, error } = await supabase
        .from('cockpit_user_vendor_link')
        .select('*')
        .eq('user_id', user!.id)
        .eq('company_id', selectedCompanyId!)
        .eq('ativo', true)
        .maybeSingle();
      if (error) throw error;
      return data as CockpitVinculo | null;
    },
    enabled: !!user?.id && !!selectedCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    vinculo: vinculo ?? null,
    isLoading,
    hasVinculo: isAdmin || !!vinculo,
    error,
  };
}
