import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LogOut, LayoutGrid, Search, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { GlobalSearchDialog } from '@/components/GlobalSearchDialog';

export function ProjectHeader({ title }: { title?: string }) {
  const { user, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium sm:inline">
            ⌘K
          </kbd>
        </button>

        {user ? (
          <>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">My projects</span>
              </Button>
            </Link>
            <Link to="/account">
              <Button variant="ghost" size="sm">
                <UserCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Account</span>
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

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
