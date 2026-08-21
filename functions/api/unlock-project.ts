// Cloudflare Pages Function: POST /api/unlock-project
//
// Verifies a plaintext password attempt against a project's stored hash
// and, on success, returns a short-lived signed unlock token instead of
// the hash or any content. The browser stores this token (see
// projectUnlockKey in src/lib/projectAccess.ts) and presents it to
// /api/project-sections on subsequent requests for that project's
// content -- it never re-sends the password after the first check.
//
// This runs entirely server-side with the service-role key: the anon
// key/RLS path can't read password_hash at all (it's excluded from
// projects_public and RLS on the base table only allows owner reads), so
// verification has to happen here, where the service-role key can see
// the hash but the hash itself never leaves this function.
//
// Body: { projectSlug: string, password: string }
// Response: { unlockToken: string } | { error: string }
//
// Requires Cloudflare Pages secrets:
//   wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
//   wrangler pages secret put PASSWORD_PEPPER
//   wrangler pages secret put UNLOCK_TOKEN_SECRET
// (UNLOCK_TOKEN_SECRET can be any long random string, generated the same
// way as PASSWORD_PEPPER; keep them as two distinct secrets so rotating
// one doesn't invalidate the other's guarantees.)

import { verifyProjectPassword } from '../../src/lib/projectAccess';
import { mintUnlockToken } from './_unlockToken';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PASSWORD_PEPPER?: string;
  UNLOCK_TOKEN_SECRET?: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Simple in-memory-per-isolate throttle: not a substitute for a real
// rate limiter (Cloudflare Workers isolates are ephemeral and this
// resets often), but it costs nothing and blunts naive scripted
// guessing loops that hit the same isolate repeatedly. Real protection
// against sustained brute force is PBKDF2's cost per attempt plus
// (recommended) a Cloudflare Rate Limiting rule on this route -- see the
// chat response for setup notes.
const attempts = new Map<string, number>();
const MAX_ATTEMPTS_PER_WINDOW = 20;
const WINDOW_MS = 60_000;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const pepper = env.PASSWORD_PEPPER;
  const tokenSecret = env.UNLOCK_TOKEN_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !pepper || !tokenSecret) {
    return json(
      {
        error:
          'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PASSWORD_PEPPER, or UNLOCK_TOKEN_SECRET Cloudflare Pages secret.',
      },
      500
    );
  }

  let body: { projectSlug?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { projectSlug, password } = body;
  if (!projectSlug || typeof password !== 'string') {
    return json({ error: 'projectSlug and password are required.' }, 400);
  }

  const throttleKey = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS);
  const bucketKey = `${throttleKey}:${windowStart}`;
  const count = (attempts.get(bucketKey) ?? 0) + 1;
  attempts.set(bucketKey, count);
  if (count > MAX_ATTEMPTS_PER_WINDOW) {
    return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429);
  }

  const projectRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(
      projectSlug
    )}&select=id,visibility,password_hash`,
    { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } }
  );
  if (!projectRes.ok) return json({ error: 'Failed to load project.' }, 502);

  const projects: Array<{ id: string; visibility: string; password_hash: string | null }> =
    await projectRes.json();
  const project = projects[0];
  if (!project) return json({ error: 'Not found.' }, 404);

  if (project.visibility !== 'password' || !project.password_hash) {
    return json({ error: 'This project is not password-protected.' }, 400);
  }

  const valid = await verifyProjectPassword(password, project.password_hash, pepper);
  if (!valid) return json({ error: 'Incorrect password.' }, 401);

  const unlockToken = await mintUnlockToken(project.id, tokenSecret);
  return json({ unlockToken }, 200);
};
