// Cloudflare Pages Function
//
// Deletes the authenticated user's account (and, via ON DELETE CASCADE in
// schema.sql, all of their projects/sections). This MUST run server-side:
// deleting an auth user requires Supabase's service-role key, which is
// never sent to the browser.
//
// Requires a Cloudflare Pages secret SUPABASE_SERVICE_ROLE_KEY in addition
// to the SUPABASE_URL already used by functions/api/config.ts. Set it with:
//   wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
// or via the dashboard (Settings -> Environment variables -> Secrets).
//
// The request must include the caller's Supabase access token in the
// Authorization header (`Authorization: Bearer <token>`). We verify that
// token against Supabase's auth server before deleting anything, so a
// caller can only ever delete their own account.

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      {
        error:
          'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set these as Cloudflare Pages secrets for this project.',
      },
      500
    );
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return json({ error: 'Missing Authorization bearer token.' }, 401);
  }

  // Verify the token and resolve the user id it belongs to. Never trust a
  // user id sent from the client for a destructive action like this.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: serviceRoleKey,
    },
  });

  if (!userRes.ok) {
    return json({ error: 'Invalid or expired session.' }, 401);
  }

  const userBody = (await userRes.json()) as { id?: string };
  const userId = userBody.id;

  if (!userId) {
    return json({ error: 'Could not resolve user from session.' }, 401);
  }

  // Delete the auth user. `projects.owner_id` references auth.users with
  // ON DELETE CASCADE (see supabase/schema.sql), so this also removes all
  // of the user's projects and, transitively, their sections.
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });

  if (!deleteRes.ok) {
    const detail = await deleteRes.text();
    return json({ error: `Failed to delete account: ${detail}` }, 500);
  }

  return json({ success: true }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
