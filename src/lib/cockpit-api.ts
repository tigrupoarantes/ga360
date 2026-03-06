/**
 * Cockpit API Helpers
 *
 * Chama as Edge Functions do cockpit via GET com query params.
 * Usado por: useAttackList, useCityDetail, useGeoHeatmap, useKPISummary (via edge function)
 *
 * Import adaptado: supabase vem de @/integrations/supabase/client (GA360 principal)
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  KPISummary,
  CityHeatmapPoint,
  CityDetail,
  ClientAttack,
  CockpitFilters,
} from '@/lib/cockpit-types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

function getDateRange(filters: CockpitFilters): { startDate: string; endDate: string } {
  const today = new Date();
  let startDate: Date;
  let endDate: Date = today;

  switch (filters.period) {
    case 'today':
      startDate = today;
      break;
    case 'week': {
      startDate = new Date(today);
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(today.getDate() - mondayOffset);
      break;
    }
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'custom':
      startDate = filters.customStartDate || new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = filters.customEndDate || today;
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

// ─── KPI Summary ─────────────────────────────────────────────

export async function fetchKPISummaryEdge(
  companyId: string,
  filters: CockpitFilters
): Promise<ApiResponse<KPISummary>> {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) return { data: null, error: 'Not authenticated' };

    const { startDate, endDate } = getDateRange(filters);
    const params = new URLSearchParams({ company_id: companyId, start_date: startDate, end_date: endDate });

    if (filters.channelCode && filters.channelCode !== 'ALL') params.append('channel_code', filters.channelCode);
    if (filters.segmentType === 'bu' && filters.segmentId) params.append('bu_id', filters.segmentId);
    if (filters.segmentType === 'industry' && filters.segmentId) params.append('industry_id', filters.segmentId);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/kpi-summary?${params}`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { data: null, error: err.error || `HTTP ${response.status}` };
    }

    return { data: await response.json(), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Geo Heatmap ─────────────────────────────────────────────

export interface GeoHeatmapResponse {
  points: CityHeatmapPoint[];
  summary: { avgPositivation: number; totalCities: number; totalSales: number };
}

export async function fetchGeoHeatmapEdge(
  companyId: string,
  filters: CockpitFilters,
  metric: 'positivacao' | 'cobertura' | 'vendas' = 'positivacao'
): Promise<ApiResponse<GeoHeatmapResponse>> {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) return { data: null, error: 'Not authenticated' };

    const { startDate, endDate } = getDateRange(filters);
    const params = new URLSearchParams({ company_id: companyId, start_date: startDate, end_date: endDate, metric });

    if (filters.channelCode && filters.channelCode !== 'ALL') params.append('channel_code', filters.channelCode);
    if (filters.segmentType === 'bu' && filters.segmentId) params.append('bu_id', filters.segmentId);
    if (filters.segmentType === 'industry' && filters.segmentId) params.append('industry_id', filters.segmentId);
    if (filters.uf) params.append('uf', filters.uf);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/geo-heatmap?${params}`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { data: null, error: err.error || `HTTP ${response.status}` };
    }

    return { data: await response.json(), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── City Detail ─────────────────────────────────────────────

export async function fetchCityDetail(
  companyId: string,
  filters: CockpitFilters,
  cityId: string
): Promise<ApiResponse<CityDetail>> {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) return { data: null, error: 'Not authenticated' };

    const { startDate, endDate } = getDateRange(filters);
    const params = new URLSearchParams({ company_id: companyId, city_id: cityId, start_date: startDate, end_date: endDate });

    if (filters.channelCode && filters.channelCode !== 'ALL') params.append('channel_code', filters.channelCode);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/city-detail?${params}`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { data: null, error: err.error || `HTTP ${response.status}` };
    }

    return { data: await response.json(), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ─── Attack List ─────────────────────────────────────────────

export interface AttackListResponse {
  clients: (ClientAttack & { cityName: string; uf: string })[];
  total: number;
}

export async function fetchAttackList(
  companyId: string,
  filters: CockpitFilters,
  cityId?: string,
  limit: number = 100
): Promise<ApiResponse<AttackListResponse>> {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) return { data: null, error: 'Not authenticated' };

    const { startDate, endDate } = getDateRange(filters);
    const params = new URLSearchParams({ company_id: companyId, start_date: startDate, end_date: endDate, limit: limit.toString() });

    if (cityId) params.append('city_id', cityId);
    if (filters.channelCode && filters.channelCode !== 'ALL') params.append('channel_code', filters.channelCode);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/attack-list?${params}`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { data: null, error: err.error || `HTTP ${response.status}` };
    }

    return { data: await response.json(), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
