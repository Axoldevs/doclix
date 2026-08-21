import { useMemo, useState } from 'react';
import { Check, X, FileText, Plus, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { diffLines, diffStats } from '@/lib/lineDiff';
import { cn } from '@/lib/utils';
import type { Section, SectionPendingChange } from '@/types/database';

interface ReviewQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: SectionPendingChange[];
  sections: Section[];
  submitterName: (userId: string) => string;
  onApprove: (change: SectionPendingChange) => Promise<{ error: string | null }>;
  onReject: (change: SectionPendingChange, note?: string) => Promise<{ error: string | null }>;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ReviewQueueDialog({
  open,
  onOpenChange,
  changes,
  sections,
  submitterName,
  onApprove,
  onReject,
}: ReviewQueueDialogProps) {
  const pending = useMemo(
    () => changes.filter((c) => c.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [changes]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);

  const selected = pending.find((c) => c.id === selectedId) ?? pending[0] ?? null;
  const currentSection = selected?.section_id ? sections.find((s) => s.id === selected.section_id) : null;

  const diff = selected
    ? diffLines(currentSection?.content ?? '', selected.proposed_content)
    : [];
  const stats = diffStats(diff);

  async function handleApprove(change: SectionPendingChange) {
    setBusy(true);
    await onApprove(change);
    setBusy(false);
    setSelectedId(null);
  }

  async function handleReject(change: SectionPendingChange) {
    setBusy(true);
    await onReject(change, rejectNote.trim() || undefined);
    setBusy(false);
    setRejectNote('');
    setShowRejectFor(null);
    setSelectedId(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Changes awaiting review</DialogTitle>
          <DialogDescription>
            {pending.length === 0
              ? 'Nothing to review right now.'
              : `${pending.length} change${pending.length === 1 ? '' : 's'} from editors awaiting approval.`}
          </DialogDescription>
        </DialogHeader>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Check className="h-6 w-6" />
            You're all caught up.
          </div>
        ) : (
          <div className="flex h-[28rem] gap-4 overflow-hidden">
            <div className="w-56 shrink-0 overflow-y-auto scrollbar-thin border-r border-border pr-2">
              {pending.map((change) => (
                <button
                  key={change.id}
                  onClick={() => setSelectedId(change.id)}
                  className={cn(
                    'mb-1 flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-xs transition-colors',
                    (selected?.id ?? pending[0]?.id) === change.id
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50'
                  )}
                >
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    {change.is_new_section ? <Plus className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    <span className="truncate">{change.proposed_title}</span>
                  </span>
                  <span className="truncate">{submitterName(change.submitted_by)}</span>
                  <span className="flex items-center gap-1 text-[10px]">
                    <Clock className="h-2.5 w-2.5" />
                    {formatTimestamp(change.created_at)}
                  </span>
                </button>
              ))}
            </div>

            {selected && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold">{selected.proposed_title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selected.is_new_section ? 'New section proposal' : 'Edit proposal'} by{' '}
                      {submitterName(selected.submitted_by)} ·{' '}
                      <span className="text-emerald-500">+{stats.added}</span>{' '}
                      <span className="text-destructive">-{stats.removed}</span>
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin rounded-md border border-border bg-secondary/20 font-mono text-xs">
                  {diff.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'whitespace-pre-wrap break-words px-2 py-0.5',
                        line.type === 'added' && 'bg-emerald-500/10 text-emerald-400',
                        line.type === 'removed' && 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                      {line.text || ' '}
                    </div>
                  ))}
                </div>

                {showRejectFor === selected.id ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <Textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Optional note for the submitter…"
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowRejectFor(null)} disabled={busy}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReject(selected)}
                        loading={busy}
                      >
                        <X className="h-3.5 w-3.5" />
                        Confirm reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectFor(selected.id)}
                      disabled={busy}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleApprove(selected)} loading={busy}>
                      <Check className="h-3.5 w-3.5" />
                      Approve & publish
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
