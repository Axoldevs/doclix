import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, FileText, BookOpen, Loader2, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { query, setQuery, results, loading, error } = useGlobalSearch();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, setQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function goTo(result: { projectSlug: string; sectionSlug?: string }) {
    onOpenChange(false);
    navigate(result.sectionSlug ? `/docs/${result.projectSlug}/${result.sectionSlug}` : `/docs/${result.projectSlug}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results[activeIndex]) {
      goTo(results[activeIndex]);
      return;
    }
    if (!query.trim()) return;
    onOpenChange(false);
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <form onSubmit={handleSubmit} className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search all projects and docs…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          </form>

          <div ref={listRef} className="max-h-96 overflow-y-auto scrollbar-thin p-2">
            {error && <p className="px-2 py-3 text-sm text-destructive">{error}</p>}

            {!error && query.trim().length >= 2 && !loading && results.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-2 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No results found</p>
                <p className="text-xs text-muted-foreground">Try a different term, or press Enter to see the full results page.</p>
              </div>
            )}

            {!error && query.trim().length < 2 && (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            )}

            {results.map((r, i) => (
              <SearchResultRow
                key={`${r.type}-${r.id}`}
                result={r}
                index={i}
                active={i === activeIndex}
                onHover={() => setActiveIndex(i)}
                onSelect={() => goTo(r)}
              />
            ))}
          </div>

          {results.length > 0 && (
            <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" />
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                Open
              </span>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SearchResultRow({
  result,
  index,
  active,
  onHover,
  onSelect,
}: {
  result: SearchResult;
  index: number;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      data-index={index}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors duration-100',
        active ? 'bg-secondary/80' : 'hover:bg-secondary/50'
      )}
    >
      <span className="flex w-full items-center gap-2 text-sm font-medium">
        {result.type === 'project' ? (
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{result.title}</span>
        {result.type === 'section' && (
          <span className="ml-auto shrink-0 truncate text-xs font-normal text-muted-foreground">
            {result.projectTitle}
          </span>
        )}
      </span>
      <span className="truncate pl-5 text-xs text-muted-foreground">{result.snippet}</span>
    </button>
  );
}
