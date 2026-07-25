import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, FileText, BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { query, setQuery, results, loading, error } = useGlobalSearch();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, setQuery]);

  function goTo(result: { projectSlug: string; sectionSlug?: string }) {
    onOpenChange(false);
    navigate(result.sectionSlug ? `/docs/${result.projectSlug}/${result.sectionSlug}` : `/docs/${result.projectSlug}`);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all projects and sections…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-thin p-2">
            {error && <p className="px-2 py-3 text-sm text-destructive">{error}</p>}

            {!error && query.trim().length >= 2 && !loading && results.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No results found.</p>
            )}

            {!error && query.trim().length < 2 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            )}

            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => goTo(r)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors duration-150',
                  'hover:bg-secondary/60'
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
                <span className="truncate text-xs text-muted-foreground">{r.snippet}</span>
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
