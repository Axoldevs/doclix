import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, FileText, LayoutGrid, List, Loader2, Search } from 'lucide-react';
import { ProjectHeader } from '@/components/ProjectHeader';
import { cn } from '@/lib/utils';
import { useGlobalSearch, type SearchTypeFilter } from '@/hooks/useGlobalSearch';

type ViewMode = 'grid' | 'list';

const TYPE_TABS: { value: SearchTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'projects', label: 'Projects' },
  { value: 'docs', label: 'Docs' },
];

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlQuery = searchParams.get('q') ?? '';
  const urlType = (searchParams.get('type') as SearchTypeFilter) || 'all';
  const urlView = (searchParams.get('view') as ViewMode) || 'grid';

  const [inputValue, setInputValue] = useState(urlQuery);
  const typeFilter: SearchTypeFilter = ['all', 'projects', 'docs'].includes(urlType) ? urlType : 'all';
  const view: ViewMode = urlView === 'list' ? 'list' : 'grid';

  const { query, setQuery, results, loading, error } = useGlobalSearch(typeFilter);

  // Keep the search hook's query in sync with the URL's ?q=
  useEffect(() => {
    setQuery(urlQuery);
    setInputValue(urlQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery, typeFilter]);

  function updateParams(next: Partial<{ q: string; type: SearchTypeFilter; view: ViewMode }>) {
    const params = new URLSearchParams(searchParams);
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    if (next.type !== undefined) {
      if (next.type === 'all') params.delete('type');
      else params.set('type', next.type);
    }
    if (next.view !== undefined) {
      if (next.view === 'grid') params.delete('view');
      else params.set('view', next.view);
    }
    setSearchParams(params);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: inputValue });
  }

  function goTo(result: { projectSlug: string; sectionSlug?: string }) {
    navigate(result.sectionSlug ? `/docs/${result.projectSlug}/${result.sectionSlug}` : `/docs/${result.projectSlug}`);
  }

  const trimmed = query.trim();
  const showEmpty = !error && trimmed.length >= 2 && !loading && results.length === 0;
  const showTooShort = !error && trimmed.length < 2;

  const resultCountLabel = useMemo(() => {
    if (loading || showTooShort) return null;
    return `${results.length} result${results.length === 1 ? '' : 's'}`;
  }, [loading, showTooShort, results.length]);

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader />

      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6">
        {/* Search bar */}
        <form onSubmit={handleSubmit} className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search all projects and docs…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        </form>

        {/* Filter tabs + view toggle */}
        <div className="mb-6 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-1">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => updateParams({ type: tab.value })}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                  typeFilter === tab.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            <button
              onClick={() => updateParams({ view: 'grid' })}
              aria-label="Grid view"
              title="Grid view"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded transition-colors duration-150',
                view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => updateParams({ view: 'list' })}
              aria-label="List view"
              title="List view"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded transition-colors duration-150',
                view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {resultCountLabel && (
          <p className="mb-4 text-xs text-muted-foreground">
            {resultCountLabel} for <span className="font-medium text-foreground">"{trimmed}"</span>
          </p>
        )}

        {error && <p className="py-8 text-center text-sm text-destructive">{error}</p>}

        {showTooShort && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </p>
        )}

        {showEmpty && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No results found. Try a different term or filter.
          </p>
        )}

        {!error && !showTooShort && results.length > 0 && (
          <div
            className={cn(
              view === 'grid'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2'
                : 'flex flex-col divide-y divide-border'
            )}
          >
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => goTo(r)}
                className={cn(
                  'flex flex-col items-start gap-1.5 text-left transition-colors duration-150',
                  view === 'grid'
                    ? 'rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-secondary/40'
                    : 'py-4 hover:bg-secondary/30'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {r.type === 'project' ? (
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {r.title}
                  {r.type === 'section' && (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      in {r.projectTitle}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{r.snippet}</span>
              </button>
            ))}
          </div>
        )}

        {!trimmed && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Back home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
