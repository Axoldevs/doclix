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
  const plain = content.replace(/[#*`_>[\]()~=-]/g, ' ').replace(/\s+/g, ' ').trim();
  const idx = plain.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return plain.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(plain.length, idx + query.length + radius);
  return `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`;
}

// Scores a title/content pair against a query so the most relevant results
// float to the top instead of relying on whatever order Postgres returns.
// Higher is better. Title matches always outrank body-only matches.
function scoreMatch(title: string, content: string, query: string): number {
  const t = title.toLowerCase();
  const c = content.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;

  if (t === q) score += 100;
  else if (t.startsWith(q)) score += 60;
  else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) score += 40;
  else if (t.includes(q)) score += 20;

  const contentIdx = c.indexOf(q);
  if (contentIdx !== -1) {
    // Earlier matches in the body are slightly more relevant, and matches
    // are worth less than any title match so titles always win ties.
    score += Math.max(1, 10 - Math.floor(contentIdx / 200));
  }

  // Reward shorter titles among otherwise-equal matches — a concise page
  // called "Auth" that matches "auth" is more likely the intended result
  // than a long one that happens to contain the word once.
  score += Math.max(0, 5 - Math.floor(title.length / 20));

  return score;
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

    const projectResults: (SearchResult & { _score: number })[] = (projectsRes.data ?? []).map((p: any) => ({
      type: 'project',
      id: p.id,
      title: p.title,
      snippet: p.description || 'No description',
      projectSlug: p.slug,
      projectTitle: p.title,
      // Projects match on title/description; weight it like a title+content match.
      _score: scoreMatch(p.title, p.description ?? '', trimmed),
    }));

    const sectionResults: (SearchResult & { _score: number })[] = (sectionsRes.data ?? []).map((s: any) => ({
      type: 'section',
      id: s.id,
      title: s.title,
      snippet: makeSnippet(s.content ?? '', trimmed),
      projectSlug: s.projects?.slug ?? '',
      projectTitle: s.projects?.title ?? '',
      sectionSlug: s.slug,
      _score: scoreMatch(s.title, s.content ?? '', trimmed),
    }));

    const ranked = [...projectResults, ...sectionResults]
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...rest }) => rest);

    setResults(ranked);
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
