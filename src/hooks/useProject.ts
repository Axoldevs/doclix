import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Project, ProjectUpdate } from '@/types/database';

// Columns exposed to the client -- deliberately everything except
// password_hash. Used both for the initial read (via the projects_public
// view, which already excludes it at the DB level) and for the
// post-update re-select (querying the base table directly, since only
// the update needs owner-only RLS, but we still don't want the hash
// coming back into browser memory/state even for the owner's own client).
const PUBLIC_PROJECT_COLUMNS =
  'id, slug, title, description, icon_url, owner_id, visibility, accent_color, custom_footer, hide_branding, custom_head_snippet, og_image_url, sitemap_excluded, enabled_languages, created_at, updated_at';

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

    // Read through projects_public, not the base table: the view omits
    // password_hash entirely, so it's structurally impossible for this
    // query to bring a hash into the browser, regardless of what select()
    // string is used here or added later.
    const { data, error } = await getSupabase()
      .from('projects_public')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      setError(error.message);
    } else if (!data) {
      setNotFound(true);
    } else {
      setProject(data as Project);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const updateProject = useCallback(
    async (updates: ProjectUpdate) => {
      if (!project) return { error: 'No project loaded' };
      // Writes go through the base table (RLS still requires
      // auth.uid() = owner_id), but the re-selected row explicitly lists
      // columns rather than using '*', so password_hash never comes back
      // into client state even though this update may be the very call
      // that just set it.
      const { data, error } = await getSupabase()
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', project.id)
        .select(PUBLIC_PROJECT_COLUMNS)
        .single();

      if (error) return { error: error.message };
      setProject(data as Project);
      return { error: null };
    },
    [project]
  );

  return { project, loading, error, notFound, refetch: fetchProject, updateProject };
}
