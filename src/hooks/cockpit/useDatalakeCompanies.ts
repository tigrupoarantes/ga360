import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DatalakeCompany } from '@/lib/cockpit-types';

interface GetCompaniesResponse {
  companies: DatalakeCompany[];
}

async function fetchCompaniesFromDatalake(): Promise<DatalakeCompany[]> {
  const { data, error } = await supabase.functions.invoke<GetCompaniesResponse>('get-companies');

  if (error) {
    console.error('Error fetching companies from Datalake:', error);
    throw new Error(error.message || 'Failed to fetch companies');
  }

  return data?.companies || [];
}

export function useDatalakeCompanies() {
  return useQuery({
    queryKey: ['datalake-companies'],
    queryFn: fetchCompaniesFromDatalake,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
