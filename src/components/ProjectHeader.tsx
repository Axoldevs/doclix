import { Link } from 'react-router-dom';
import { BookOpen, LogOut, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

export function ProjectHeader({ title }: { title?: string }) {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2 pl-9 md:pl-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold tracking-tight">DOCLIX</span>
        {title && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate text-sm text-muted-foreground">{title}</span>
          </>
        )}
      </Link>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">My projects</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </>
        ) : (
          <Link to="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
