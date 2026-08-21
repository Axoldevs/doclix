// Cloudflare Pages Function: POST /api/accept-invite
//
// Redeems a project_invites row for the signed-in caller: verifies the
// invite token exists, hasn't expired, and matches the caller's email,
// then creates the corresponding project_members row and deletes the
// invite. Runs server-side with the service-role key because inserting
// into project_members on someone else's behalf (the inviter's behalf,
// really -- the invite already encodes their intent) isn't something
// the invite-redeemer's own RLS grants would allow otherwise, and we
// need to cross-reference the invite's target email against the
// caller's actual auth email server-side rather than trust a client-sent
// email string.
//
// Body: { token: string }
// Response: { projectSlug: string, role: string } | { error }

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' }, 500);
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'Missing Authorization bearer token.' }, 401);

  let payload: { token?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!payload.token) return json({ error: 'Missing invite token.' }, 400);

  const callerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: serviceRoleKey },
  });
  if (!callerRes.ok) return json({ error: 'Invalid or expired session.' }, 401);
  const caller = (await callerRes.json()) as { id?: string; email?: string };
  if (!caller.id || !caller.email) return json({ error: 'Could not resolve user from session.' }, 401);

  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json',
  };

  const inviteRes = await fetch(
    `${supabaseUrl}/rest/v1/project_invites?token=eq.${encodeURIComponent(payload.token)}&select=*`,
    { headers }
  );
  if (!inviteRes.ok) return json({ error: 'Failed to look up invite.' }, 500);
  const invites = (await inviteRes.json()) as {
    id: string;
    project_id: string;
    email: string;
    role: string;
    expires_at: string;
  }[];
  const invite = invites[0];
  if (!invite) return json({ error: 'This invite link is invalid or has already been used.' }, 404);

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await fetch(`${supabaseUrl}/rest/v1/project_invites?id=eq.${invite.id}`, {
      method: 'DELETE',
      headers,
    });
    return json({ error: 'This invite has expired. Ask the project owner to send a new one.' }, 410);
  }

  if (invite.email.toLowerCase() !== caller.email.toLowerCase()) {
    return json(
      { error: `This invite was sent to ${invite.email}. Sign in with that email to accept it.` },
      403
    );
  }

  const memberRes = await fetch(
    `${supabaseUrl}/rest/v1/project_members?on_conflict=project_id,user_id`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        project_id: invite.project_id,
        user_id: caller.id,
        role: invite.role,
      }),
    }
  );
  if (!memberRes.ok) {
    const detail = await memberRes.text();
    return json({ error: `Failed to join project: ${detail}` }, 500);
  }

  await fetch(`${supabaseUrl}/rest/v1/project_invites?id=eq.${invite.id}`, {
    method: 'DELETE',
    headers,
  });

  const projectRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?id=eq.${invite.project_id}&select=slug`,
    { headers }
  );
  const [project] = (await projectRes.json()) as { slug: string }[];

  return json({ projectSlug: project?.slug ?? null, role: invite.role }, 200);
};
