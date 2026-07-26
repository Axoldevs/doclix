import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Section } from '@/types/database';

export function useSections(projectId: string | undefined) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await getSupabase()
      .from('sections')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setSections(data ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const createSection = useCallback(
    async (input: { title: string; slug: string; content?: string }) => {
      if (!projectId) return { error: 'Missing project', section: null };

      const nextPosition = sections.length
        ? Math.max(...sections.map((s) => s.position)) + 1
        : 0;

      const { data, error } = await getSupabase()
        .from('sections')
        .insert({
          project_id: projectId,
          title: input.title,
          slug: input.slug,
          content: input.content ?? '',
          position: nextPosition,
        })
        .select()
        .single();

      if (error) return { error: error.message, section: null };

      setSections((prev) => [...prev, data]);
      return { error: null, section: data };
    },
    [projectId, sections]
  );

  // Insert a new section at a specific index in the ordered list (e.g. "insert
  // after section X"), shifting every section from that index onward down by one
  // position. `insertAtIndex` follows array semantics: 0 = first, sections.length = last.
  const createSectionAt = useCallback(
    async (input: { title: string; slug: string; content?: string }, insertAtIndex: number) => {
      if (!projectId) return { error: 'Missing project', section: null };

      const clampedIndex = Math.max(0, Math.min(insertAtIndex, sections.length));
      const supabase = getSupabase();

      // Shift positions of everything at/after the insertion point to make room.
      const toShift = sections.slice(clampedIndex);
      if (toShift.length > 0) {
        const shiftResults = await Promise.all(
          toShift.map((s) => supabase.from('sections').update({ position: s.position + 1 }).eq('id', s.id))
        );
        const shiftFailed = shiftResults.find((r) => r.error);
        if (shiftFailed?.error) return { error: shiftFailed.error.message, section: null };
      }

      const newPosition = clampedIndex === 0 ? -1 : sections[clampedIndex - 1].position + 1;
      // If inserting at the very start, normalize to 0 and bump others (already shifted above).
      const finalPosition = clampedIndex === 0 ? 0 : newPosition;

      const { data, error } = await supabase
        .from('sections')
        .insert({
          project_id: projectId,
          title: input.title,
          slug: input.slug,
          content: input.content ?? '',
          position: finalPosition,
        })
        .select()
        .single();

      if (error) return { error: error.message, section: null };

      setSections((prev) => {
        const shifted = prev.map((s, idx) => (idx >= clampedIndex ? { ...s, position: s.position + 1 } : s));
        const next = [...shifted];
        next.splice(clampedIndex, 0, data);
        return next;
      });

      return { error: null, section: data };
    },
    [projectId, sections]
  );

  const duplicateSection = useCallback(
    async (id: string) => {
      const source = sections.find((s) => s.id === id);
      if (!source || !projectId) return { error: 'Section not found', section: null };

      const insertAtIndex = sections.findIndex((s) => s.id === id) + 1;
      const takenSlugs = new Set(sections.map((s) => s.slug));
      let candidateSlug = `${source.slug}-copy`;
      let n = 2;
      while (takenSlugs.has(candidateSlug)) {
        candidateSlug = `${source.slug}-copy-${n++}`;
      }

      return createSectionAt(
        { title: `${source.title} (copy)`, slug: candidateSlug, content: source.content },
        insertAtIndex
      );
    },
    [sections, projectId, createSectionAt]
  );

  const createSections = useCallback(
    async (inputs: { title: string; slug: string; content?: string }[]) => {
      if (!projectId) return { error: 'Missing project', sections: null };
      if (inputs.length === 0) return { error: null, sections: [] };

      let nextPosition = sections.length
        ? Math.max(...sections.map((s) => s.position)) + 1
        : 0;

      const rows = inputs.map((input) => ({
        project_id: projectId,
        title: input.title,
        slug: input.slug,
        content: input.content ?? '',
        position: nextPosition++,
      }));

      const { data, error } = await getSupabase().from('sections').insert(rows).select();

      if (error) return { error: error.message, sections: null };

      setSections((prev) => [...prev, ...data]);
      return { error: null, sections: data };
    },
    [projectId, sections]
  );

  const updateSection = useCallback(
    async (id: string, updates: { title?: string; content?: string; slug?: string }) => {
      const { data, error } = await getSupabase()
        .from('sections')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return { error: error.message, section: null };

      setSections((prev) => prev.map((s) => (s.id === id ? data : s)));
      return { error: null, section: data };
    },
    []
  );

  const deleteSection = useCallback(async (id: string) => {
    const { error } = await getSupabase().from('sections').delete().eq('id', id);
    if (error) return { error: error.message };
    setSections((prev) => prev.filter((s) => s.id !== id));
    return { error: null };
  }, []);

  const reorderSections = useCallback(async (orderedIds: string[]) => {
    // Optimistic local reorder first
    setSections((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      return orderedIds
        .map((id, idx) => {
          const s = map.get(id);
          return s ? { ...s, position: idx } : undefined;
        })
        .filter((s): s is Section => Boolean(s));
    });

    const supabase = getSupabase();
    const updates = orderedIds.map((id, idx) =>
      supabase.from('sections').update({ position: idx }).eq('id', id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { error: failed.error.message };
    }
    return { error: null };
  }, []);

  return {
    sections,
    loading,
    error,
    refetch: fetchSections,
    createSection,
    createSectionAt,
    createSections,
    duplicateSection,
    updateSection,
    deleteSection,
    reorderSections,
  };
}
