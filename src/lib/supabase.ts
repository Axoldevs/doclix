import { createClient } from '@supabase/supabase-js';

// SUPABASE_URL and SUPABASE_ANON_KEY are stored as Cloudflare Secrets and
// injected into the build/runtime environment as VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY. Never hardcode these values or commit them to
// version control. See README.md for setup instructions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY are set (sourced from Cloudflare Secrets). See README.md.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
