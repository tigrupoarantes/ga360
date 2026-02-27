// Cliente Supabase Externo
// Este arquivo cria o cliente usando as credenciais do Supabase externo,
// independente de configurações em arquivo .env

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { EXTERNAL_SUPABASE_CONFIG } from '@/config/supabase.config';

// Cliente conectado ao Supabase externo
export const supabaseExternal = createClient<Database>(
  EXTERNAL_SUPABASE_CONFIG.url,
  EXTERNAL_SUPABASE_CONFIG.anonKey,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Exportação padrão para compatibilidade com imports existentes
export const supabase = supabaseExternal;
