import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Search, FileText, LayoutGrid, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { query, setQuery, results, loading } = useGlobalSearch();
  const [focused, setFocused] = useState(false);

  function goTo(result: { projectSlug: string; sectionSlug?: string }) {
    navigate(
      result.sectionSlug ? `/docs/${result.projectSlug}/${result.sectionSlug}` : `/docs/${result.projectSlug}`
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.14),transparent_60%)]" />

      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>

        <p className="text-7xl font-bold tracking-tight text-primary/90 sm:text-8xl">404</p>
        <h1 className="font-display mt-3 text-xl font-semibold sm:text-2xl">This page doesn't exist</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The doc, project, or page you're looking for may have moved, been renamed, or never
          existed. Try searching for it below.
        </p>
      </div>

      {/* Inline search, reusing the same global search as the rest of the app */}
      <div className="mt-8 w-full max-w-md">
        <div
          className={
            'flex items-center gap-2 rounded-lg border bg-card px-4 py-3 shadow-sm transition-all duration-200 ' +
            (focused ? 'border-primary/50 shadow-[0_16px_50px_-20px_hsl(var(--primary)/0.35)]' : 'border-border')
          }
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search all docs…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        {query.trim().length >= 2 && (
          <div className="mt-2 max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-border bg-card p-2 shadow-sm">
            {!loading && results.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">No results found.</p>
            )}
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => goTo(r)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-secondary/60"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {r.title}
                  {r.type === 'section' && (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      in {r.projectTitle}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{r.snippet}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Link to="/">
          <Button variant="outline">Back home</Button>
        </Link>
        <Link to="/dashboard">
          <Button>
            <LayoutGrid className="h-3.5 w-3.5" />
            My projects
          </Button>
        </Link>
      </div>
    </div>
  );
}
