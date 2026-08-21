import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { resolveMentions, type MentionableUser } from '@/lib/mentions';
import { notifyUser } from '@/lib/notify';
import type { Project, Section, SectionComment } from '@/types/database';

export interface CommentThread extends SectionComment {
  replies: SectionComment[];
}

/** Groups a flat comment list into top-level comments with nested
 * replies (one level deep -- matches the product spec's threaded example
 * and keeps the UI simple; a reply-to-a-reply just attaches to the same
 * top-level thread). */
export function groupIntoThreads(comments: SectionComment[]): CommentThread[] {
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, SectionComment[]>();
  for (const c of comments) {
    if (!c.parent_comment_id) continue;
    // A reply-to-a-reply is re-parented to the top-level ancestor so
    // threads stay one level deep in the UI.
    const parent = comments.find((p) => p.id === c.parent_comment_id);
    const rootId = parent && !parent.parent_comment_id ? parent.id : parent?.parent_comment_id ?? c.parent_comment_id;
    const list = repliesByParent.get(rootId) ?? [];
    list.push(c);
    repliesByParent.set(rootId, list);
  }
  return topLevel.map((c) => ({
    ...c,
    replies: (repliesByParent.get(c.id) ?? []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  }));
}

export function useSectionComments(
  sectionId: string | undefined,
  project?: Project | null,
  section?: Section | null
) {
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await getSupabase()
      .from('section_comments')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true });

    if (error) setError(error.message);
    else setComments(data ?? []);
    setLoading(false);
  }, [sectionId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(
    async (input: {
      authorId: string;
      authorName: string;
      body: string;
      parentCommentId?: string | null;
      mentionCandidates?: MentionableUser[];
    }) => {
      if (!sectionId) return { error: 'No section', comment: null };
      const { userIds: mentionedUserIds } = resolveMentions(
        input.body,
        input.mentionCandidates ?? []
      );

      const { data, error } = await getSupabase()
        .from('section_comments')
        .insert({
          section_id: sectionId,
          author_id: input.authorId,
          author_name: input.authorName,
          body: input.body,
          parent_comment_id: input.parentCommentId ?? null,
          mentioned_user_ids: mentionedUserIds,
        })
        .select()
        .single();

      if (error) return { error: error.message, comment: null };
      setComments((prev) => [...prev, data]);

      // Notify: mentioned users, plus (if this is a reply) the parent
      // comment's author, provided they're not the same person and not
      // the one posting.
      if (project && section) {
        const linkPath = `/docs/${project.slug}/${section.slug}`;
        for (const userId of mentionedUserIds) {
          if (userId === input.authorId) continue;
          await notifyUser(userId, {
            projectId: project.id,
            kind: 'mention',
            actorId: input.authorId,
            actorName: input.authorName,
            message: `${input.authorName} mentioned you in a comment on "${section.title}".`,
            linkPath,
          });
        }
        if (input.parentCommentId) {
          const parent = comments.find((c) => c.id === input.parentCommentId);
          if (
            parent &&
            parent.author_id !== input.authorId &&
            !mentionedUserIds.includes(parent.author_id)
          ) {
            await notifyUser(parent.author_id, {
              projectId: project.id,
              kind: 'reply',
              actorId: input.authorId,
              actorName: input.authorName,
              message: `${input.authorName} replied to your comment on "${section.title}".`,
              linkPath,
            });
          }
        }
      }

      return { error: null, comment: data };
    },
    [sectionId, project, section, comments]
  );

  const editComment = useCallback(async (id: string, body: string) => {
    const { data, error } = await getSupabase()
      .from('section_comments')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: error.message };
    setComments((prev) => prev.map((c) => (c.id === id ? data : c)));
    return { error: null };
  }, []);

  const toggleResolved = useCallback(async (id: string, resolved: boolean) => {
    const { data, error } = await getSupabase()
      .from('section_comments')
      .update({ resolved })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };
    setComments((prev) => prev.map((c) => (c.id === id ? data : c)));
    return { error: null };
  }, []);

  const deleteComment = useCallback(async (id: string) => {
    const { error } = await getSupabase().from('section_comments').delete().eq('id', id);
    if (error) return { error: error.message };
    // Deleting a top-level comment cascades to its replies at the DB
    // level (parent_comment_id references ... on delete cascade), so
    // drop both from local state to match.
    setComments((prev) => prev.filter((c) => c.id !== id && c.parent_comment_id !== id));
    return { error: null };
  }, []);

  return {
    comments,
    threads: groupIntoThreads(comments),
    loading,
    error,
    addComment,
    editComment,
    toggleResolved,
    deleteComment,
    refetch: fetchComments,
  };
}
