import { useQuery } from '@tanstack/react-query';
import { fetchCityDetail } from '@/lib/cockpit-api';
import { useCockpitFilters } from '@/contexts/CockpitFiltersContext';
import { useCompany } from '@/contexts/CompanyContext';
import type { CityDetail } from '@/lib/cockpit-types';

export function useCityDetail(cityId: string | null) {
  const { filters } = useCockpitFilters();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery<CityDetail | null, Error>({
    queryKey: ['city-detail', companyId, filters, cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const result = await fetchCityDetail(companyId!, filters, cityId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!companyId && !!cityId,
    retry: 1,
  });
}
