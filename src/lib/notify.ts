import { getSupabase } from '@/lib/supabase';
import type { NotificationKind, Project } from '@/types/database';

interface NotifyInput {
  kind: NotificationKind;
  actorId?: string;
  actorName?: string;
  message: string;
  linkPath?: string;
}

/** Insert a notification for a specific user. */
export async function notifyUser(
  userId: string,
  input: NotifyInput & { projectId: string }
) {
  if (userId === input.actorId) return; // don't notify people about their own actions
  await getSupabase()
    .from('notifications')
    .insert({
      user_id: userId,
      project_id: input.projectId,
      kind: input.kind,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      message: input.message,
      link_path: input.linkPath ?? null,
    });
}

/** Insert a notification for every owner/admin on a project (the people
 * who can review pending changes), excluding the actor themselves. */
export async function notifyProjectManagers(project: Project, input: NotifyInput) {
  const { data: admins } = await getSupabase()
    .from('project_members')
    .select('user_id')
    .eq('project_id', project.id)
    .eq('role', 'admin');

  const recipientIds = new Set<string>([project.owner_id, ...(admins ?? []).map((a) => a.user_id)]);
  recipientIds.delete(input.actorId ?? '');

  if (recipientIds.size === 0) return;

  const rows = Array.from(recipientIds).map((userId) => ({
    user_id: userId,
    project_id: project.id,
    kind: input.kind,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    message: input.message,
    link_path: input.linkPath ?? null,
  }));

  await getSupabase().from('notifications').insert(rows);
}
