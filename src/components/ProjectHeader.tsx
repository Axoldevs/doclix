import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LogOut, LayoutGrid, Search, UserCircle, Moon, Sun, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { GlobalSearchDialog } from '@/components/GlobalSearchDialog';
import { ProjectIcon } from '@/components/ProjectIcon';
import { NotificationBell } from '@/components/NotificationBell';

export function ProjectHeader({ title, iconUrl }: { title?: string; iconUrl?: string | null }) {
  const { user, signOut } = useAuth();
  const t = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
      {title ? (
        <Link to={user ? '/dashboard' : '/'} className="flex min-w-0 items-center gap-2 pl-9 md:pl-0">
          <ProjectIcon iconUrl={iconUrl} size="sm" />
          <span className="truncate font-display text-[15px] font-semibold tracking-tight">{title}</span>
        </Link>
      ) : (
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2 pl-9 md:pl-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight">DOCLIX</span>
        </Link>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        {user && <NotificationBell />}

        {/* Full action row: shown once there's room for it (md+) */}
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{t('nav.search')}</span>
            <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>

          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>{t('nav.myProjects')}</span>
                </Button>
              </Link>
              <Link to="/account">
                <Button variant="ghost" size="sm">
                  <UserCircle className="h-3.5 w-3.5" />
                  <span>{t('nav.account')}</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut className="h-3.5 w-3.5" />
                <span>{t('nav.signOut')}</span>
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm">{t('nav.signIn')}</Button>
            </Link>
          )}
        </div>

        {/* Collapsed burger menu: shown below md, where the full row doesn't fit */}
        <div ref={menuRef} className="relative md:hidden">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-xl">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setSearchOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
              >
                <Search className="h-3.5 w-3.5" />
                {t('nav.search')}
              </button>

              {user ? (
                <>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {t('nav.myProjects')}
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                  >
                    <UserCircle className="h-3.5 w-3.5" />
                    {t('nav.account')}
                  </Link>
                  <div className="my-1 h-px bg-border" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t('nav.signOut')}
                  </button>
                </>
              ) : (
                <>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                  >
                    <UserCircle className="h-3.5 w-3.5" />
                    {t('nav.signIn')}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
