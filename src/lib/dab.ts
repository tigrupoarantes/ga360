/**
 * DAB (Datalake API Builder) Client
 *
 * Todas as chamadas ao DAB passam pela Edge Function `dab-proxy`
 * que injeta X-API-Key server-side (nunca exposta no browser).
 *
 * Import adaptado: supabase vem de @/integrations/supabase/client (GA360 principal)
 */

import { supabase } from '@/integrations/supabase/client';
import type { DabResponse } from '@/lib/cockpit-types';

export type { DabResponse };

export interface DabFetchOptions {
  /** Path do endpoint DAB (ex: 'venda_prod', 'stock_position') */
  path: string;
  /** Query params OData (ex: { '$first': 100, 'dt_ini': '2026-01-01' }) */
  query?: Record<string, string | number>;
  /** URL absoluta de paginação (nextLink) — ignora path/query quando presente */
  absoluteNextLink?: string;
}

/**
 * Chama a DAB API via Edge Function `dab-proxy`.
 * Retorna `{ value: T[], nextLink?: string }`.
 */
export async function dabFetch<T = Record<string, unknown>>(
  options: DabFetchOptions
): Promise<DabResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Usuário não autenticado. Faça login novamente.');
  }

  const body: Record<string, unknown> = {};

  if (options.absoluteNextLink) {
    body.absoluteNextLink = options.absoluteNextLink;
    body.path = 'paginated'; // placeholder — proxy ignora quando absoluteNextLink presente
  } else {
    body.path = options.path;
    if (options.query) {
      body.query = options.query;
    }
  }

  const { data, error } = await supabase.functions.invoke('dab-proxy', { body });

  if (error) {
    console.error('dab-proxy error:', error);
    throw new Error(error.message || 'Erro ao chamar dab-proxy');
  }

  return data as DabResponse<T>;
}
