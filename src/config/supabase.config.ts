// Configuração do Supabase Externo
// As credenciais devem vir exclusivamente das variáveis de ambiente VITE_*

const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENV_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!ENV_SUPABASE_URL || (!ENV_SUPABASE_PUBLISHABLE_KEY && !ENV_SUPABASE_ANON_KEY)) {
  console.error('[supabase.config] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos. Verifique o arquivo .env');
}

export const EXTERNAL_SUPABASE_CONFIG = {
  url: ENV_SUPABASE_URL ?? '',
  anonKey: ENV_SUPABASE_PUBLISHABLE_KEY ?? ENV_SUPABASE_ANON_KEY ?? '',
  projectId: ENV_SUPABASE_PROJECT_ID ?? '',
};
