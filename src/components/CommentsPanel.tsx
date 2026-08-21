import { useState, type FormEvent } from 'react';
import {
  X,
  Send,
  Check,
  RotateCcw,
  Trash2,
  MessageSquare,
  Loader2,
  Reply,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSectionComments, type CommentThread } from '@/hooks/useSectionComments';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { canComment as roleCanComment, canManageMembers } from '@/lib/permissions';
import type { MentionableUser } from '@/lib/mentions';
import type { Project, ProjectRole, Section, SectionComment } from '@/types/database';

interface CommentsPanelProps {
  open: boolean;
  onClose: () => void;
  sectionId: string | undefined;
  project?: Project | null;
  section?: Section | null;
  role: ProjectRole;
  mentionCandidates?: MentionableUser[];
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function CommentRow({
  comment,
  canModerate,
  isAuthor,
  onResolveToggle,
  onDelete,
  onEdit,
  onReply,
  isReply,
}: {
  comment: SectionComment;
  canModerate: boolean;
  isAuthor: boolean;
  onResolveToggle?: () => void;
  onDelete: () => void;
  onEdit: (body: string) => void;
  onReply?: () => void;
  isReply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  return (
    <div className={cn('text-sm', isReply && 'ml-4 border-l-2 border-border pl-3')}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate font-medium">{comment.author_name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTimestamp(comment.created_at)}
          {comment.updated_at && ' (edited)'}
        </span>
      </div>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="text-sm" />
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (draft.trim()) onEdit(draft.trim());
                setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
      )}
      {!editing && (
        <div className="mt-1.5 flex items-center gap-3">
          {onReply && (
            <button onClick={onReply} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
          {onResolveToggle && (
            <button
              onClick={onResolveToggle}
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
          )}
          {isAuthor && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
          {(canModerate || isAuthor) && (
            <button onClick={onDelete} className="flex items-center gap-1 text-xs text-destructive/80 hover:text-destructive">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CommentsPanel({ open, onClose, sectionId, project, section, role, mentionCandidates }: CommentsPanelProps) {
  const { user } = useAuth();
  const { threads, loading, addComment, editComment, toggleResolved, deleteComment } = useSectionComments(
    open ? sectionId : undefined,
    project,
    section
  );
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommentThread | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  if (!open) return null;

  const canModerate = canManageMembers(role); // owner/admin can moderate any comment
  const canWriteComments = roleCanComment(role);
  const visible = threads.filter((t) => showResolved || !t.resolved);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user) return;
    setSubmitting(true);
    const authorName = user.user_metadata?.display_name || user.email || 'Anonymous';
    const { error } = await addComment({
      authorId: user.id,
      authorName,
      body: body.trim(),
      mentionCandidates,
    });
    setSubmitting(false);
    if (!error) setBody('');
  }

  async function handleReplySubmit(thread: CommentThread) {
    if (!replyBody.trim() || !user) return;
    setSubmittingReply(true);
    const authorName = user.user_metadata?.display_name || user.email || 'Anonymous';
    const { error } = await addComment({
      authorId: user.id,
      authorName,
      body: replyBody.trim(),
      parentCommentId: thread.id,
      mentionCandidates,
    });
    setSubmittingReply(false);
    if (!error) {
      setReplyBody('');
      setReplyingTo(null);
    }
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
          {visible.length} {visible.length === 1 ? 'thread' : 'threads'}
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
            No comments yet. {canWriteComments ? 'Leave feedback or a question below.' : ''}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((thread) => (
              <div
                key={thread.id}
                className={cn('rounded-lg border border-border p-3', thread.resolved && 'opacity-60')}
              >
                <CommentRow
                  comment={thread}
                  canModerate={canModerate}
                  isAuthor={thread.author_id === user?.id}
                  onResolveToggle={canModerate || thread.author_id === user?.id ? () => toggleResolved(thread.id, !thread.resolved) : undefined}
                  onDelete={() => deleteComment(thread.id)}
                  onEdit={(newBody) => editComment(thread.id, newBody)}
                  onReply={canWriteComments ? () => setReplyingTo(thread) : undefined}
                />

                {thread.replies.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {thread.replies.map((reply) => (
                      <CommentRow
                        key={reply.id}
                        comment={reply}
                        canModerate={canModerate}
                        isAuthor={reply.author_id === user?.id}
                        onDelete={() => deleteComment(reply.id)}
                        onEdit={(newBody) => editComment(reply.id, newBody)}
                        isReply
                      />
                    ))}
                  </div>
                )}

                {replyingTo?.id === thread.id && (
                  <div className="mt-2 ml-4 flex flex-col gap-1.5 border-l-2 border-border pl-3">
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Reply…"
                      rows={2}
                      className="text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" loading={submittingReply} onClick={() => handleReplySubmit(thread)} disabled={!replyBody.trim()}>
                        Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {user && canWriteComments && (
        <form onSubmit={handleSubmit} className="border-t border-border p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a comment… use @name to mention a teammate"
            rows={3}
            className="mb-2 text-sm"
          />
          <Button type="submit" size="sm" className="w-full" loading={submitting} disabled={!body.trim()}>
            <Send className="h-3.5 w-3.5" />
            Comment
          </Button>
        </form>
      )}

      {user && !canWriteComments && (
        <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          Viewers can't comment on this project.
        </div>
      )}
    </div>
  );
}
