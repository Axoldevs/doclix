// Cloudflare Pages Function
//
// Serves public Supabase connection details to the client at runtime,
// sourced from Cloudflare Secrets (SUPABASE_URL / SUPABASE_ANON_KEY) set
// via `wrangler pages secret put <NAME>` or the Cloudflare dashboard
// (Settings -> Environment variables -> Secrets, or the "Secrets" bindings
// for Pages projects).
//
// This avoids baking these values into the JS bundle at build time, so:
//   - rotating keys does not require a rebuild/redeploy
//   - preview and production deployments can point at different projects
//     purely via dashboard config, with no branching build logic
//
// Note: the Supabase "anon" key is safe to expose to the browser by design
// (it is constrained by Row Level Security policies), so returning it here
// is not a secret leak -- the benefit of this endpoint is operational
// (rotation, per-env config), not confidentiality of this particular value.
// If additional, higher-privilege keys are ever introduced, they must NOT
// be added to this endpoint.

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error:
          'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Set these as Cloudflare Pages secrets (Settings -> Environment variables) for this project.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Runtime config can change (key rotation) without a redeploy,
        // so it should never be cached by the browser or intermediate caches.
        'Cache-Control': 'no-store',
      },
    }
  );
};
