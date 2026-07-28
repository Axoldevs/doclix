import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Project } from '@/types/database';

export function useProject(slug: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setNotFound(false);

    const { data, error } = await getSupabase()
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      setError(error.message);
    } else if (!data) {
      setNotFound(true);
    } else {
      setProject(data);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const updateProject = useCallback(
    async (updates: { title?: string; description?: string | null; slug?: string }) => {
      if (!project) return { error: 'No project loaded' };
      const { data, error } = await getSupabase()
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', project.id)
        .select()
        .single();

      if (error) return { error: error.message };
      setProject(data);
      return { error: null };
    },
    [project]
  );

  return { project, loading, error, notFound, refetch: fetchProject, updateProject };
}
