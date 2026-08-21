import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { ProjectInvite, ProjectMember, StoredProjectRole } from '@/types/database';

export function useProjectMembers(projectId: string | undefined) {
  const { session } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    const [membersRes, invitesRes] = await Promise.all([
      getSupabase()
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      getSupabase()
        .from('project_invites')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
    ]);

    if (membersRes.error) setError(membersRes.error.message);
    else setMembers(membersRes.data ?? []);

    // Invites are only visible to owners/admins (RLS); a non-manager
    // will just get an empty array back, not an error, so this is safe
    // to call unconditionally.
    if (!invitesRes.error) setInvites(invitesRes.data ?? []);

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const inviteMember = useCallback(
    async (email: string, role: StoredProjectRole) => {
      if (!projectId || !session) return { error: 'Not signed in', status: null, inviteLink: null };
      try {
        const res = await fetch('/api/invite-member', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ projectId, email, role }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          status?: 'added' | 'invited';
          inviteLink?: string;
        };
        if (!res.ok) return { error: body.error ?? 'Failed to invite member.', status: null, inviteLink: null };
        await fetchAll();
        return { error: null, status: body.status ?? null, inviteLink: body.inviteLink ?? null };
      } catch {
        return { error: 'Network error while inviting.', status: null, inviteLink: null };
      }
    },
    [projectId, session, fetchAll]
  );

  const updateMemberRole = useCallback(
    async (memberId: string, role: StoredProjectRole) => {
      const { data, error } = await getSupabase()
        .from('project_members')
        .update({ role })
        .eq('id', memberId)
        .select()
        .single();
      if (error) return { error: error.message };
      setMembers((prev) => prev.map((m) => (m.id === memberId ? data : m)));
      return { error: null };
    },
    []
  );

  const removeMember = useCallback(async (memberId: string) => {
    const { error } = await getSupabase().from('project_members').delete().eq('id', memberId);
    if (error) return { error: error.message };
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    return { error: null };
  }, []);

  const revokeInvite = useCallback(async (inviteId: string) => {
    const { error } = await getSupabase().from('project_invites').delete().eq('id', inviteId);
    if (error) return { error: error.message };
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    return { error: null };
  }, []);

  return {
    members,
    invites,
    loading,
    error,
    inviteMember,
    updateMemberRole,
    removeMember,
    revokeInvite,
    refetch: fetchAll,
  };
}
