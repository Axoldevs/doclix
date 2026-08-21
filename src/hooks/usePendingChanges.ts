import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { notifyProjectManagers, notifyUser } from '@/lib/notify';
import type { Project, Section, SectionPendingChange } from '@/types/database';

/**
 * Manages the "Editor ≠ Publisher" review queue for a project. Editors
 * submit proposed title/content here; owners/admins review and either
 * approve (apply to `sections`, which still fires the existing revision
 * trigger) or reject. Approve/reject/submit each also drop a
 * notification for the relevant party -- see src/lib/notify.ts.
 */
export function usePendingChanges(project: Project | null | undefined) {
  const { user } = useAuth();
  const [changes, setChanges] = useState<SectionPendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChanges = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    setError(null);
    const { data, error } = await getSupabase()
      .from('section_pending_changes')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setChanges(data ?? []);
    setLoading(false);
  }, [project]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  const pendingCount = changes.filter((c) => c.status === 'pending').length;

  /** Editor proposes an edit to an existing section. */
  const submitEdit = useCallback(
    async (section: Section, proposedTitle: string, proposedContent: string) => {
      if (!project || !user) return { error: 'Not signed in', change: null };
      const { data, error } = await getSupabase()
        .from('section_pending_changes')
        .insert({
          project_id: project.id,
          section_id: section.id,
          proposed_title: proposedTitle,
          proposed_content: proposedContent,
          is_new_section: false,
          submitted_by: user.id,
        })
        .select()
        .single();

      if (error) return { error: error.message, change: null };
      setChanges((prev) => [data, ...prev]);

      const authorName = user.user_metadata?.display_name || user.email || 'Someone';
      await notifyProjectManagers(project, {
        kind: 'change_submitted',
        actorId: user.id,
        actorName: authorName,
        message: `${authorName} submitted a change to "${section.title}" for review.`,
        linkPath: `/docs/${project.slug}/${section.slug}?review=${data.id}`,
      });

      return { error: null, change: data };
    },
    [project, user]
  );

  /** Editor proposes a brand-new section. */
  const submitNewSection = useCallback(
    async (proposedTitle: string, proposedSlug: string, proposedContent: string) => {
      if (!project || !user) return { error: 'Not signed in', change: null };
      const { data, error } = await getSupabase()
        .from('section_pending_changes')
        .insert({
          project_id: project.id,
          section_id: null,
          proposed_title: proposedTitle,
          proposed_slug: proposedSlug,
          proposed_content: proposedContent,
          is_new_section: true,
          submitted_by: user.id,
        })
        .select()
        .single();

      if (error) return { error: error.message, change: null };
      setChanges((prev) => [data, ...prev]);

      const authorName = user.user_metadata?.display_name || user.email || 'Someone';
      await notifyProjectManagers(project, {
        kind: 'change_submitted',
        actorId: user.id,
        actorName: authorName,
        message: `${authorName} proposed a new section "${proposedTitle}" for review.`,
        linkPath: `/docs/${project.slug}`,
      });

      return { error: null, change: data };
    },
    [project, user]
  );

  const withdraw = useCallback(async (changeId: string) => {
    const { error } = await getSupabase().from('section_pending_changes').delete().eq('id', changeId);
    if (error) return { error: error.message };
    setChanges((prev) => prev.filter((c) => c.id !== changeId));
    return { error: null };
  }, []);

  /**
   * Approve applies the proposed content to `sections` (creating it if
   * `is_new_section`), marks the change approved, and notifies the
   * submitter. `applySection` is provided by the caller (DocProjectPage
   * already owns useSections' createSection/updateSection) so this hook
   * doesn't need its own duplicate section-mutation logic.
   */
  const approve = useCallback(
    async (
      change: SectionPendingChange,
      apply: (change: SectionPendingChange) => Promise<{ error: string | null }>
    ) => {
      if (!project || !user) return { error: 'Not signed in' };
      const { error: applyError } = await apply(change);
      if (applyError) return { error: applyError };

      const { data, error } = await getSupabase()
        .from('section_pending_changes')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', change.id)
        .select()
        .single();
      if (error) return { error: error.message };
      setChanges((prev) => prev.map((c) => (c.id === change.id ? data : c)));

      const reviewerName = user.user_metadata?.display_name || user.email || 'A reviewer';
      await notifyUser(change.submitted_by, {
        projectId: project.id,
        kind: 'change_approved',
        actorId: user.id,
        actorName: reviewerName,
        message: `${reviewerName} approved and published your change to "${change.proposed_title}".`,
        linkPath: `/docs/${project.slug}`,
      });

      return { error: null };
    },
    [project, user]
  );

  const reject = useCallback(
    async (change: SectionPendingChange, note?: string) => {
      if (!project || !user) return { error: 'Not signed in' };
      const { data, error } = await getSupabase()
        .from('section_pending_changes')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_note: note ?? null,
        })
        .eq('id', change.id)
        .select()
        .single();
      if (error) return { error: error.message };
      setChanges((prev) => prev.map((c) => (c.id === change.id ? data : c)));

      const reviewerName = user.user_metadata?.display_name || user.email || 'A reviewer';
      await notifyUser(change.submitted_by, {
        projectId: project.id,
        kind: 'change_rejected',
        actorId: user.id,
        actorName: reviewerName,
        message: note
          ? `${reviewerName} requested changes to "${change.proposed_title}": ${note}`
          : `${reviewerName} rejected your change to "${change.proposed_title}".`,
        linkPath: `/docs/${project.slug}`,
      });

      return { error: null };
    },
    [project, user]
  );

  return {
    changes,
    pendingCount,
    loading,
    error,
    submitEdit,
    submitNewSection,
    withdraw,
    approve,
    reject,
    refetch: fetchChanges,
  };
}
