// Cloudflare Pages Function: POST /api/project-password
//
// Sets, changes, or clears a project's password. This MUST run
// server-side: hashing happens with a server-only pepper, and the write
// uses the service-role key so the plaintext password and the resulting
// hash never round-trip through anything the browser can inspect beyond
// this one request/response pair.
//
// Body: { projectId: string, newPassword: string | null }
// Passing newPassword: null clears the password (used when switching a
// project's visibility away from "password").
//
// Requires the caller's Supabase access token in the Authorization
// header. We verify the token, then verify the resolved user actually
// owns the project, before writing anything -- never trust a projectId
// alone to authorize this.
//
// Requires Cloudflare Pages secrets:
//   wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
//   wrangler pages secret put PASSWORD_PEPPER
// (PASSWORD_PEPPER can be any long random string; generate one with
// `openssl rand -hex 32` and never reuse it elsewhere.)

import { hashProjectPassword } from '../../src/lib/projectAccess';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PASSWORD_PEPPER?: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const pepper = env.PASSWORD_PEPPER;

  if (!supabaseUrl || !serviceRoleKey || !pepper) {
    return json(
      { error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PASSWORD_PEPPER Cloudflare Pages secret.' },
      500
    );
  }

  let body: { projectId?: string; newPassword?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { projectId, newPassword } = body;
  if (!projectId || typeof projectId !== 'string') {
    return json({ error: 'projectId is required.' }, 400);
  }
  if (newPassword !== null && (typeof newPassword !== 'string' || newPassword.length < 4)) {
    return json({ error: 'Password must be at least 4 characters, or null to clear it.' }, 400);
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'Missing Authorization bearer token.' }, 401);

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: serviceRoleKey },
  });
  if (!userRes.ok) return json({ error: 'Invalid or expired session.' }, 401);
  const userBody = (await userRes.json()) as { id?: string };
  const userId = userBody.id;
  if (!userId) return json({ error: 'Could not resolve user from session.' }, 401);

  // Confirm the caller can manage this project's settings (owner or
  // admin -- "Project settings" per the permission matrix) before
  // touching anything.
  const headers = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };
  const projectRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=id,owner_id`,
    { headers }
  );
  if (!projectRes.ok) return json({ error: 'Failed to load project.' }, 502);
  const projects: Array<{ id: string; owner_id: string }> = await projectRes.json();
  const project = projects[0];
  if (!project) return json({ error: 'Project not found.' }, 404);

  let canManage = project.owner_id === userId;
  if (!canManage) {
    const memberRes = await fetch(
      `${supabaseUrl}/rest/v1/project_members?project_id=eq.${projectId}&user_id=eq.${userId}&select=role`,
      { headers }
    );
    const members = (await memberRes.json()) as { role: string }[];
    canManage = members[0]?.role === 'admin';
  }
  if (!canManage) return json({ error: 'Only owners and admins can change project settings.' }, 403);

  const passwordHash = newPassword === null ? null : await hashProjectPassword(newPassword, pepper);

  const updateRes = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ password_hash: passwordHash, updated_at: new Date().toISOString() }),
  });

  if (!updateRes.ok) {
    const detail = await updateRes.text();
    return json({ error: `Failed to update password: ${detail}` }, 500);
  }

  return json({ success: true }, 200);
};
