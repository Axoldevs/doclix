// Cloudflare Pages Function: POST /api/project-sections
//
// The single real gate for reading section CONTENT of a non-public
// project. Public projects don't need this -- the client reads them
// directly via Supabase RLS/projects_public for speed -- but private and
// password-protected projects route through here, using the
// service-role key server-side, because:
//   - RLS on `sections` (see schema.sql) only allows direct reads for
//     public projects or the owner, so a private/password project's
//     content is NOT reachable via the anon key at all.
//   - This function is therefore the only path to that content, and it
//     enforces the same rule itself: private requires the caller's own
//     session to match project.owner_id; password requires a valid,
//     non-expired unlock token minted by /api/unlock-project for this
//     exact project.
//
// Body: { projectSlug: string, unlockToken?: string }
// Authorization header (optional): Bearer <supabase access token>, used
// only to check ownership for private projects.
//
// Response: { project: {...}, sections: [...] } | { error, gate }
// `gate` on a 401/403 response tells the client which UI to show
// ('private' | 'password' | null), without ever including any section
// content in that response.

import { verifyUnlockToken } from './_unlockToken';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  UNLOCK_TOKEN_SECRET?: string;
}

interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  owner_id: string;
  visibility: 'public' | 'private' | 'password';
  accent_color: string | null;
  custom_footer: string | null;
  hide_branding: boolean;
  custom_head_snippet: string | null;
  og_image_url: string | null;
  sitemap_excluded: boolean;
  enabled_languages: string[];
  created_at: string;
  updated_at: string;
}

const PROJECT_PUBLIC_COLUMNS =
  'id,slug,title,description,icon_url,owner_id,visibility,accent_color,custom_footer,hide_branding,custom_head_snippet,og_image_url,sitemap_excluded,enabled_languages,created_at,updated_at';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** True if userId owns the project or has any explicit project_members
 * role (admin/editor/commenter/viewer) -- i.e. isTeamMember() from
 * lib/permissions.ts, checked server-side with the service-role key
 * since this function runs before the caller has an authenticated
 * Supabase client of their own. */
async function isProjectTeamMember(
  supabaseUrl: string,
  serviceHeaders: Record<string, string>,
  project: ProjectRow,
  userId: string | undefined
): Promise<boolean> {
  if (!userId) return false;
  if (userId === project.owner_id) return true;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/project_members?project_id=eq.${project.id}&user_id=eq.${userId}&select=user_id`,
    { headers: serviceHeaders }
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const tokenSecret = env.UNLOCK_TOKEN_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !tokenSecret) {
    return json(
      { error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or UNLOCK_TOKEN_SECRET Cloudflare Pages secret.' },
      500
    );
  }

  let body: { projectSlug?: string; unlockToken?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { projectSlug, unlockToken } = body;
  if (!projectSlug) return json({ error: 'projectSlug is required.' }, 400);

  const serviceHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

  const projectRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(projectSlug)}&select=${PROJECT_PUBLIC_COLUMNS}`,
    { headers: serviceHeaders }
  );
  if (!projectRes.ok) return json({ error: 'Failed to load project.' }, 502);
  const projects: ProjectRow[] = await projectRes.json();
  const project = projects[0];
  if (!project) return json({ error: 'Not found.' }, 404);

  let authorized = project.visibility === 'public';

  if (!authorized && project.visibility === 'private') {
    const authHeader = request.headers.get('Authorization') ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (accessToken) {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: serviceRoleKey },
      });
      if (userRes.ok) {
        const userBody = (await userRes.json()) as { id?: string };
        authorized = await isProjectTeamMember(supabaseUrl, serviceHeaders, project, userBody.id);
      }
    }
    if (!authorized) return json({ error: 'This project is private.', gate: 'private' }, 403);
  }

  if (!authorized && project.visibility === 'password') {
    if (unlockToken && (await verifyUnlockToken(unlockToken, project.id, tokenSecret))) {
      authorized = true;
    } else {
      // Team members (owner, admin, editor, commenter -- anyone who
      // isn't a plain default-viewer) should always be able to view/edit
      // their own password-protected project without entering the
      // password, so fall back to checking the session the same way
      // "private" does before giving up and asking for the password.
      const authHeader = request.headers.get('Authorization') ?? '';
      const accessToken = authHeader.replace(/^Bearer\s+/i, '');
      if (accessToken) {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${accessToken}`, apikey: serviceRoleKey },
        });
        if (userRes.ok) {
          const userBody = (await userRes.json()) as { id?: string };
          authorized = await isProjectTeamMember(supabaseUrl, serviceHeaders, project, userBody.id);
        }
      }
    }
    if (!authorized) return json({ error: 'This project is password-protected.', gate: 'password' }, 401);
  }

  const sectionsRes = await fetch(
    `${supabaseUrl}/rest/v1/sections?project_id=eq.${project.id}&select=*&order=position.asc`,
    { headers: serviceHeaders }
  );
  if (!sectionsRes.ok) return json({ error: 'Failed to load sections.' }, 502);
  const sections = await sectionsRes.json();

  return json({ project, sections }, 200);
};
