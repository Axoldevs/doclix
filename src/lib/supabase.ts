import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase connection details are fetched at runtime from a Cloudflare
// Pages Function (functions/api/config.ts), which reads them from
// Cloudflare Secrets. This keeps them out of the built JS bundle and lets
// keys be rotated or changed per-environment without a rebuild/redeploy.
//
// Call `initSupabase()` once, before rendering the app (see main.tsx).
// After that, `getSupabase()` returns the initialized client synchronously.

let client: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  error?: string;
}

async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  const res = await fetch('/api/config');
  const body = (await res.json()) as RuntimeConfig;

  if (!res.ok || !body.supabaseUrl || !body.supabaseAnonKey) {
    throw new Error(
      body.error ??
        'Failed to load Supabase runtime configuration from /api/config.'
    );
  }

  return body;
}

/**
 * Fetches runtime config and creates the Supabase client. Safe to call
 * multiple times -- subsequent calls return the same in-flight/resolved
 * promise rather than re-fetching.
 */
export function initSupabase(): Promise<SupabaseClient> {
  if (initPromise) return initPromise;

  initPromise = fetchRuntimeConfig().then(({ supabaseUrl, supabaseAnonKey }) => {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return client;
  });

  return initPromise;
}

/**
 * Returns the already-initialized Supabase client. Throws if called before
 * `initSupabase()` has resolved -- callers should only run after the app's
 * root has confirmed initialization succeeded (see main.tsx).
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase client accessed before initialization. Ensure initSupabase() has resolved before rendering app content.'
    );
  }
  return client;
}
