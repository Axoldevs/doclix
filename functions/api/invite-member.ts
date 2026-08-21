// Cloudflare Pages Function: POST /api/invite-member
//
// Invites a user to a project by email. Looking up an auth user by email
// requires the service-role key (auth.users isn't queryable from the
// client), so this whole flow runs server-side:
//   1. Verify the caller's access token and confirm they're an
//      owner/admin on the target project (RLS would also block a
//      mismatched insert, but we check explicitly to give a clean error
//      message rather than a generic RLS failure).
//   2. Look up the invitee by email via the admin API.
//   3. If they already have an account, add a project_members row for
//      them directly. If not, create a project_invites row with a random
//      token; the invite is redeemed via /api/accept-invite once they
//      sign up (or sign in, if they already had an account under a
//      different email -- not handled here, they'd need the exact
//      invited email).
//
// There's no outbound email sending configured for this project, so the
// response includes an `inviteLink` the caller can copy and send
// themselves for the not-yet-registered case.
//
// Body: { projectId: string, email: string, role: 'admin'|'editor'|'commenter'|'viewer' }
// Response: { status: 'added', member: {...} } | { status: 'invited', inviteLink: string } | { error }
//
// Requires the same SUPABASE_SERVICE_ROLE_KEY secret as delete-account.ts.

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const VALID_ROLES = ['admin', 'editor', 'commenter', 'viewer'];

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' }, 500);
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'Missing Authorization bearer token.' }, 401);

  let payload: { projectId?: string; email?: string; role?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { projectId, role } = payload;
  const email = payload.email?.trim().toLowerCase();

  if (!projectId || !email || !role) {
    return json({ error: 'projectId, email, and role are required.' }, 400);
  }
  if (!VALID_ROLES.includes(role)) {
    return json({ error: 'Invalid role.' }, 400);
  }

  // Verify the caller.
  const callerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: serviceRoleKey },
  });
  if (!callerRes.ok) return json({ error: 'Invalid or expired session.' }, 401);
  const caller = (await callerRes.json()) as { id?: string };
  if (!caller.id) return json({ error: 'Could not resolve user from session.' }, 401);

  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json',
  };

  // Confirm caller is owner or admin on this project.
  const projectRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=id,owner_id`,
    { headers }
  );
  if (!projectRes.ok) return json({ error: 'Failed to look up project.' }, 500);
  const projects = (await projectRes.json()) as { id: string; owner_id: string }[];
  const project = projects[0];
  if (!project) return json({ error: 'Project not found.' }, 404);

  const isOwner = project.owner_id === caller.id;
  let isAdmin = false;
  if (!isOwner) {
    const memberRes = await fetch(
      `${supabaseUrl}/rest/v1/project_members?project_id=eq.${projectId}&user_id=eq.${caller.id}&select=role`,
      { headers }
    );
    const members = (await memberRes.json()) as { role: string }[];
    isAdmin = members[0]?.role === 'admin';
  }
  if (!isOwner && !isAdmin) {
    return json({ error: 'Only owners and admins can invite members.' }, 403);
  }
  // Only the owner can grant the admin role -- mirrors the DB policy.
  if (role === 'admin' && !isOwner) {
    return json({ error: 'Only the project owner can grant the admin role.' }, 403);
  }
  if (email === (await (async () => {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${caller.id}`, { headers });
    if (!res.ok) return null;
    const u = (await res.json()) as { email?: string };
    return u.email?.toLowerCase() ?? null;
  })())) {
    return json({ error: "You can't invite yourself." }, 400);
  }

  // Look up the invitee by email using Supabase's admin user list filter.
  const lookupRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers }
  );
  if (!lookupRes.ok) return json({ error: 'Failed to look up invitee.' }, 500);
  const lookupBody = (await lookupRes.json()) as { users?: { id: string; email?: string }[] };
  const existingUser = lookupBody.users?.find((u) => u.email?.toLowerCase() === email);

  if (existingUser) {
    // Already has an account -- add (or update) the membership directly.
    if (existingUser.id === project.owner_id) {
      return json({ error: 'This user already owns the project.' }, 400);
    }
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/project_members?on_conflict=project_id,user_id`,
      {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          project_id: projectId,
          user_id: existingUser.id,
          role,
          invited_by: caller.id,
        }),
      }
    );
    if (!upsertRes.ok) {
      const detail = await upsertRes.text();
      return json({ error: `Failed to add member: ${detail}` }, 500);
    }
    const [member] = (await upsertRes.json()) as unknown[];
    return json({ status: 'added', member }, 200);
  }

  // No account yet -- create a pending invite the person can redeem
  // after signing up.
  const token = randomToken();
  const inviteRes = await fetch(
    `${supabaseUrl}/rest/v1/project_invites?on_conflict=project_id,email`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        project_id: projectId,
        email,
        role,
        invited_by: caller.id,
        token,
      }),
    }
  );
  if (!inviteRes.ok) {
    const detail = await inviteRes.text();
    return json({ error: `Failed to create invite: ${detail}` }, 500);
  }
  const [invite] = (await inviteRes.json()) as { token: string }[];

  const url = new URL(request.url);
  const inviteLink = `${url.origin}/invite/${invite.token}`;

  return json({ status: 'invited', inviteLink }, 200);
};
