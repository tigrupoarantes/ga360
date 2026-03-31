// _shared/cors.ts — CORS seguro para todas as Edge Functions do GA360
// Importar em cada função: import { corsHeaders, handleCors } from '../_shared/cors.ts'

const ALLOWED_ORIGINS = [
  'https://ga360.grupoarantes.emp.br',
  'https://ga360.vercel.app',
  'https://ga360-ga-ti.vercel.app',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-d4sign-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

/** Handle OPTIONS preflight — retorna Response pronta ou null se não for preflight */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}

/**
 * @deprecated Use getCorsHeaders(req) instead. This static version exists only
 * for backward compatibility during migration and will be removed.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-d4sign-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Vary': 'Origin',
};
