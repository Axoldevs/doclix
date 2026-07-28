import { useState } from 'react';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useSectionRevisions } from '@/hooks/useSectionRevisions';
import type { SectionRevision } from '@/types/database';
import { cn } from '@/lib/utils';

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string | undefined;
  currentContent: string;
  onRestore: (content: string) => Promise<void>;
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HistoryDialog({ open, onOpenChange, sectionId, currentContent, onRestore }: HistoryDialogProps) {
  const { revisions, loading, error } = useSectionRevisions(open ? sectionId : undefined);
  const [selected, setSelected] = useState<SectionRevision | null>(null);
  const [restoring, setRestoring] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(null);
    onOpenChange(next);
  }

  async function handleRestore() {
    if (!selected) return;
    setRestoring(true);
    await onRestore(selected.content);
    setRestoring(false);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Version history
          </DialogTitle>
          <DialogDescription>
            Every save that changed content creates a snapshot. Pick one to preview, then restore it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : revisions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No past versions yet. A snapshot is saved automatically the next time this section's content changes.
          </p>
        ) : (
          <div className="grid grid-cols-[160px_1fr] gap-3">
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto scrollbar-thin border-r border-border pr-2">
              {revisions.map((rev) => (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => setSelected(rev)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150',
                    selected?.id === rev.id
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60'
                  )}
                >
                  {formatTimestamp(rev.created_at)}
                </button>
              ))}
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs whitespace-pre-wrap">
              {selected ? selected.content || '(empty)' : 'Select a version to preview its content.'}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleRestore}
            disabled={!selected || selected.content === currentContent}
            loading={restoring}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore this version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
