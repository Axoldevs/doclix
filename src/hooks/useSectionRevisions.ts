import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { SectionRevision } from '@/types/database';

export function useSectionRevisions(sectionId: string | undefined) {
  const [revisions, setRevisions] = useState<SectionRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRevisions = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await getSupabase()
      .from('section_revisions')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setRevisions(data ?? []);
    setLoading(false);
  }, [sectionId]);

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  return { revisions, loading, error, refetch: fetchRevisions };
}
