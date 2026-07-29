import { Link, useParams, Navigate } from 'react-router-dom';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { getPostBySlug, formatPostDate } from '@/lib/blog';
import { renderMarkdown } from '@/lib/markdown';

export default function BlogPostPage() {
  const { postSlug } = useParams<{ postSlug: string }>();
  const post = getPostBySlug(postSlug ?? '');

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight">DOCLIX</span>
        </Link>
        <Link
          to="/blog"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Blog
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        <article>
          <time className="text-xs font-medium text-muted-foreground">
            {formatPostDate(post.date)}
          </time>
          <h1 className="font-display mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">{post.title}</h1>

          <div
            className="doclix-prose mt-8 text-[0.95rem] text-foreground/90"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />
        </article>
      </main>
    </div>
  );
}
