import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export interface SearchResult {
  type: 'project' | 'section';
  id: string;
  title: string;
  snippet: string;
  projectSlug: string;
  projectTitle: string;
  sectionSlug?: string;
}

function makeSnippet(content: string, query: string, radius = 60): string {
  const plain = content.replace(/[#*`_>[\]()~-]/g, ' ').replace(/\s+/g, ' ').trim();
  const idx = plain.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return plain.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(plain.length, idx + query.length + radius);
  return `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`;
}

export type SearchTypeFilter = 'all' | 'projects' | 'docs';

// Searches across every project's title/description and every section's
// title/content. Read access is public (RLS allows select on all rows), so
// this is a genuinely global search, not scoped to the signed-in user.
// `typeFilter` narrows results to only projects or only docs (sections);
// "docs" is the user-facing name for what the schema calls sections.
export function useGlobalSearch(typeFilter: SearchTypeFilter = 'all') {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async (q: string, filter: SearchTypeFilter) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const supabase = getSupabase();

    const wantProjects = filter === 'all' || filter === 'projects';
    const wantDocs = filter === 'all' || filter === 'docs';

    const [projectsRes, sectionsRes] = await Promise.all([
      wantProjects
        ? supabase
            .from('projects')
            .select('id, slug, title, description')
            .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
            .limit(wantDocs ? 8 : 30)
        : Promise.resolve({ data: [], error: null } as any),
      wantDocs
        ? supabase
            .from('sections')
            .select('id, slug, title, content, project_id, projects!inner(slug, title)')
            .or(`title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`)
            .limit(wantProjects ? 20 : 40)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (requestId !== requestIdRef.current) return; // stale response, ignore

    if (projectsRes.error || sectionsRes.error) {
      setError(projectsRes.error?.message ?? sectionsRes.error?.message ?? 'Search failed');
      setResults([]);
      setLoading(false);
      return;
    }

    const projectResults: SearchResult[] = (projectsRes.data ?? []).map((p: any) => ({
      type: 'project',
      id: p.id,
      title: p.title,
      snippet: p.description || 'No description',
      projectSlug: p.slug,
      projectTitle: p.title,
    }));

    const sectionResults: SearchResult[] = (sectionsRes.data ?? []).map((s: any) => ({
      type: 'section',
      id: s.id,
      title: s.title,
      snippet: makeSnippet(s.content ?? '', trimmed),
      projectSlug: s.projects?.slug ?? '',
      projectTitle: s.projects?.title ?? '',
      sectionSlug: s.slug,
    }));

    setResults([...projectResults, ...sectionResults]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, typeFilter), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, typeFilter, runSearch]);

  return { query, setQuery, results, loading, error };
}
