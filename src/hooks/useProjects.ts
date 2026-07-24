import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setProjects(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(
    async (input: { title: string; description: string | null; slug: string }) => {
      if (!user) return { error: 'You must be signed in.', project: null };

      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: input.title,
          description: input.description,
          slug: input.slug,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) return { error: error.message, project: null };

      setProjects((prev) => [data, ...prev]);
      return { error: null, project: data };
    },
    [user]
  );

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return { error: error.message };
    setProjects((prev) => prev.filter((p) => p.id !== id));
    return { error: null };
  }, []);

  return { projects, loading, error, refetch: fetchProjects, createProject, deleteProject };
}
