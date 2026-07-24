import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Section } from '@/types/database';

export function SectionFooterNav({
  projectSlug,
  prev,
  next,
}: {
  projectSlug: string;
  prev: Section | null;
  next: Section | null;
}) {
  if (!prev && !next) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-4 sm:px-8">
      {prev ? (
        <Link
          to={`/docs/${projectSlug}/${prev.slug}`}
          className="group flex max-w-[45%] items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary/60 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          to={`/docs/${projectSlug}/${next.slug}`}
          className="group flex max-w-[45%] items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary/60 hover:text-foreground"
        >
          <span className="truncate">{next.title}</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
