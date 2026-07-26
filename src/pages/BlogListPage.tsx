import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, ArrowLeft } from 'lucide-react';
import { getAllPosts, formatPostDate } from '@/lib/blog';

export default function BlogListPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">DOCLIX</span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            What's new in DOCLIX, and why we built it that way.
          </p>
        </div>

        {posts.length === 0 && (
          <p className="rounded-xl border border-border bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground">
            No posts yet. Check back soon.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group rounded-2xl border border-border bg-card/60 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_40px_-24px_hsl(var(--primary)/0.5)]"
            >
              <time className="text-xs font-medium text-muted-foreground">
                {formatPostDate(post.date)}
              </time>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{post.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                Read post
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
