import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Project, SectionSuggestion } from '@/types/database';

/** Submitting is available to anyone, signed in or not -- this is the
 * lightweight "Suggest an improvement" box for visitors who aren't team
 * members. Reading the list back is restricted by RLS to commenter+. */
export function useSectionSuggestions(projectId: string | undefined, canView: boolean) {
  const [suggestions, setSuggestions] = useState<SectionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!projectId || !canView) return;
    setLoading(true);
    const { data, error } = await getSupabase()
      .from('section_suggestions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (!error) setSuggestions(data ?? []);
    setLoading(false);
  }, [projectId, canView]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const submitSuggestion = useCallback(
    async (input: {
      sectionId: string;
      projectId: string;
      body: string;
      name?: string;
      email?: string;
    }) => {
      const { error } = await getSupabase().from('section_suggestions').insert({
        section_id: input.sectionId,
        project_id: input.projectId,
        body: input.body,
        suggester_name: input.name || null,
        suggester_email: input.email || null,
      });
      if (error) return { error: error.message };
      return { error: null };
    },
    []
  );

  const updateStatus = useCallback(
    async (id: string, status: SectionSuggestion['status']) => {
      const { data, error } = await getSupabase()
        .from('section_suggestions')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) return { error: error.message };
      setSuggestions((prev) => prev.map((s) => (s.id === id ? data : s)));
      return { error: null };
    },
    []
  );

  const deleteSuggestion = useCallback(async (id: string) => {
    const { error } = await getSupabase().from('section_suggestions').delete().eq('id', id);
    if (error) return { error: error.message };
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    return { error: null };
  }, []);

  return { suggestions, loading, submitSuggestion, updateStatus, deleteSuggestion, refetch: fetchSuggestions };
}

/** Notifies project managers when a new suggestion comes in. Kept
 * separate from the hook above since submission is usable by anonymous
 * visitors who don't have standing to query project_members for the
 * recipient list -- callers with access (e.g. a team member's own
 * client after their own submission) can invoke this, but the common
 * anonymous-visitor path just calls submitSuggestion and skips it. */
export async function notifySuggestion(project: Project, sectionTitle: string) {
  const { notifyProjectManagers } = await import('@/lib/notify');
  await notifyProjectManagers(project, {
    kind: 'suggestion_submitted',
    message: `A visitor suggested an improvement to "${sectionTitle}".`,
    linkPath: `/docs/${project.slug}`,
  });
}
