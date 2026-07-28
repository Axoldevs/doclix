import { useState, type FormEvent } from 'react';
import { X, Send, Check, RotateCcw, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSectionComments } from '@/hooks/useSectionComments';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

interface CommentsPanelProps {
  open: boolean;
  onClose: () => void;
  sectionId: string | undefined;
  isOwner: boolean;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CommentsPanel({ open, onClose, sectionId, isOwner }: CommentsPanelProps) {
  const { user } = useAuth();
  const { comments, loading, addComment, toggleResolved, deleteComment } = useSectionComments(
    open ? sectionId : undefined
  );
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  if (!open) return null;

  const visible = comments.filter((c) => showResolved || !c.resolved);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user) return;
    setSubmitting(true);
    const authorName = user.user_metadata?.display_name || user.email || 'Anonymous';
    const { error } = await addComment({ authorId: user.id, authorName, body: body.trim() });
    setSubmitting(false);
    if (!error) setBody('');
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Comments
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <span>
          {visible.length} {visible.length === 1 ? 'comment' : 'comments'}
        </span>
        <button
          onClick={() => setShowResolved((prev) => !prev)}
          className="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No comments yet. Leave feedback or a question below.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((comment) => {
              const canModerate = isOwner || comment.author_id === user?.id;
              return (
                <div
                  key={comment.id}
                  className={cn(
                    'rounded-lg border border-border p-3 text-sm',
                    comment.resolved && 'opacity-60'
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{comment.author_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatTimestamp(comment.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
                  {canModerate && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => toggleResolved(comment.id, !comment.resolved)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {comment.resolved ? (
                          <>
                            <RotateCcw className="h-3 w-3" /> Reopen
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3" /> Resolve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="flex items-center gap-1 text-xs text-destructive/80 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {user && (
        <form onSubmit={handleSubmit} className="border-t border-border p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a comment…"
            rows={3}
            className="mb-2 text-sm"
          />
          <Button type="submit" size="sm" className="w-full" loading={submitting} disabled={!body.trim()}>
            <Send className="h-3.5 w-3.5" />
            Comment
          </Button>
        </form>
      )}
    </div>
  );
}
