import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Project, ProjectRole } from '@/types/database';

/**
 * Resolves the signed-in user's effective role on a project: 'owner' if
 * they own it, the stored project_members.role if they have an explicit
 * grant, or 'viewer' as the default for any other signed-in user.
 * Anonymous (signed-out) visitors get null -- callers that want to treat
 * anonymous readers as viewer-equivalent for read-only UI should do
 * `role ?? 'viewer'` themselves; kept distinct here because some surfaces
 * (comments, suggestions) behave differently for anonymous vs. a
 * signed-in-but-role-less viewer.
 */
export function useProjectRole(project: Project | null | undefined) {
  const { user } = useAuth();
  const [role, setRole] = useState<ProjectRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!project || !user) {
      setRole(null);
      setLoading(false);
      return;
    }
    if (user.id === project.owner_id) {
      setRole('owner');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await getSupabase()
      .from('project_members')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      setRole('viewer');
    } else {
      setRole(data?.role ?? 'viewer');
    }
    setLoading(false);
  }, [project, user]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return { role, loading, refetch: fetchRole };
}
