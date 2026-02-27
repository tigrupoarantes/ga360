// Configuração do Supabase Externo
// Este arquivo contém as credenciais hardcoded para garantir independência do arquivo .env

const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENV_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const EXTERNAL_SUPABASE_CONFIG = {
  url: ENV_SUPABASE_URL || "https://zveqhxaiwghexfobjaek.supabase.co",
  anonKey: ENV_SUPABASE_PUBLISHABLE_KEY || ENV_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZXFoeGFpd2doZXhmb2JqYWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTM0ODAsImV4cCI6MjA4NTM2OTQ4MH0.N2EEwDUfWlZTWlHMJAC777eELMxmpyOyrJ087kPex3Y",
  projectId: ENV_SUPABASE_PROJECT_ID || "zveqhxaiwghexfobjaek"
};
