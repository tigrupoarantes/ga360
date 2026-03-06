import { useQuery } from '@tanstack/react-query';
import { fetchAttackList, type AttackListResponse } from '@/lib/cockpit-api';
import { useCockpitFilters } from '@/contexts/CockpitFiltersContext';
import { useCompany } from '@/contexts/CompanyContext';

export function useAttackList(cityId?: string, limit: number = 100) {
  const { filters } = useCockpitFilters();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery<AttackListResponse | null, Error>({
    queryKey: ['attack-list', companyId, filters, cityId, limit],
    queryFn: async () => {
      const result = await fetchAttackList(companyId!, filters, cityId, limit);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!companyId,
    retry: 1,
  });
}
