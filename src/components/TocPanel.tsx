import { useMemo } from 'react';
import { List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractHeadings } from '@/lib/markdown';

interface TocPanelProps {
  content: string;
  className?: string;
}

export function TocPanel({ content, className }: TocPanelProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-border bg-card p-3', className)}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <List className="h-3.5 w-3.5" />
        On this page
      </div>
      <nav className="flex flex-col gap-1 text-sm">
        {headings.map((h, idx) => (
          <a
            key={`${h.id}-${idx}`}
            href={`#${h.id}`}
            className={cn(
              'truncate text-muted-foreground transition-colors duration-150 hover:text-primary',
              h.level === 1 && 'font-medium text-foreground',
              h.level === 2 && 'pl-3',
              h.level === 3 && 'pl-6'
            )}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  );
}
