import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Profile, Project, ProjectMember } from '@/types/database';
import type { MentionableUser } from '@/lib/mentions';

export interface TeamProfile {
  userId: string;
  name: string;
  email: string;
}

/** Resolves display profiles for every team member on a project (owner
 * + everyone in project_members), for showing real names in the members
 * list and for @mention resolution in comments. Falls back to the raw
 * email (or user id, as a last resort) if a profile row is somehow
 * missing. */
export function useProjectTeamProfiles(project: Project | null | undefined, members: ProjectMember[]) {
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const ids = Array.from(new Set([project.owner_id, ...members.map((m) => m.user_id)]));

    getSupabase()
      .from('profiles')
      .select('*')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled) return;
        const byId = new Map((data ?? []).map((p: Profile) => [p.id, p]));
        setProfiles(
          ids.map((id) => {
            const p = byId.get(id);
            return { userId: id, name: p?.display_name || p?.email || id, email: p?.email ?? '' };
          })
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project, members]);

  const mentionCandidates: MentionableUser[] = profiles.map((p) => ({ userId: p.userId, name: p.name }));

  return { profiles, mentionCandidates, loading };
}
