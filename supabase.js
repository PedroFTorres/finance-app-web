const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Configuração do Supabase ausente. Verifique se config.js foi carregado antes de supabase.js."
  );
}

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
