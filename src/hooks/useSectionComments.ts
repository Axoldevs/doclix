import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { SectionComment } from '@/types/database';

export function useSectionComments(sectionId: string | undefined) {
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await getSupabase()
      .from('section_comments')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true });

    if (error) setError(error.message);
    else setComments(data ?? []);
    setLoading(false);
  }, [sectionId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(
    async (input: { authorId: string; authorName: string; body: string }) => {
      if (!sectionId) return { error: 'No section', comment: null };
      const { data, error } = await getSupabase()
        .from('section_comments')
        .insert({
          section_id: sectionId,
          author_id: input.authorId,
          author_name: input.authorName,
          body: input.body,
        })
        .select()
        .single();

      if (error) return { error: error.message, comment: null };
      setComments((prev) => [...prev, data]);
      return { error: null, comment: data };
    },
    [sectionId]
  );

  const toggleResolved = useCallback(async (id: string, resolved: boolean) => {
    const { data, error } = await getSupabase()
      .from('section_comments')
      .update({ resolved })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };
    setComments((prev) => prev.map((c) => (c.id === id ? data : c)));
    return { error: null };
  }, []);

  const deleteComment = useCallback(async (id: string) => {
    const { error } = await getSupabase().from('section_comments').delete().eq('id', id);
    if (error) return { error: error.message };
    setComments((prev) => prev.filter((c) => c.id !== id));
    return { error: null };
  }, []);

  return { comments, loading, error, addComment, toggleResolved, deleteComment, refetch: fetchComments };
}
