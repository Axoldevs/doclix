import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Section } from '@/types/database';

// A small floating pill-style control that sits at the bottom of the
// document content, similar to a watermark. It is positioned in normal
// document flow (not `fixed`/`sticky`), so it does not follow the reader
// while scrolling — it only ever appears once they reach the end of a
// section's content.
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
    <div className="mt-10 flex justify-center px-4 pb-2 sm:px-8">
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-card/90 p-1 shadow-lg shadow-black/5 backdrop-blur-sm transition-shadow duration-300 hover:shadow-xl">
        <NavButton
          direction="prev"
          section={prev}
          projectSlug={projectSlug}
        />
        <div className="h-4 w-px shrink-0 bg-border" />
        <NavButton
          direction="next"
          section={next}
          projectSlug={projectSlug}
        />
      </div>
    </div>
  );
}

function NavButton({
  direction,
  section,
  projectSlug,
}: {
  direction: 'prev' | 'next';
  section: Section | null;
  projectSlug: string;
}) {
  const isPrev = direction === 'prev';

  if (!section) {
    return <div className="h-9 w-9 sm:w-28" aria-hidden />;
  }

  return (
    <Link
      to={`/docs/${projectSlug}/${section.slug}`}
      title={section.title}
      className={cn(
        'group flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-all duration-200',
        'hover:bg-secondary/80 hover:text-foreground',
        isPrev ? 'flex-row' : 'flex-row-reverse'
      )}
    >
      {isPrev ? (
        <ChevronLeft className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
      )}
      <span className="hidden max-w-[10rem] truncate sm:inline">{section.title}</span>
    </Link>
  );
}
