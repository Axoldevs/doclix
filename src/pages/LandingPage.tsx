import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Search,
  FileText,
  GitBranch,
  Zap,
  ArrowRight,
  FileText as FileIcon,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';

function LiveSearchDemo() {
  const { query, setQuery, results, loading } = useGlobalSearch();
  const navigate = useNavigate();
  const t = useTranslation();
  const [focused, setFocused] = useState(false);

  function goTo(result: { projectSlug: string; sectionSlug?: string }) {
    navigate(result.sectionSlug ? `/docs/${result.projectSlug}/${result.sectionSlug}` : `/docs/${result.projectSlug}`);
  }

  const showPanel = focused && query.trim().length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border bg-card/80 px-5 py-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-all duration-300',
          focused ? 'border-primary/50 shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.35)]' : 'border-border'
        )}
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t('landing.searchPlaceholder')}
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-border bg-secondary/60 px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 max-h-72 overflow-y-auto scrollbar-thin rounded-2xl border border-border bg-card p-2 text-left shadow-2xl animate-fade-up">
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('landing.searchEmpty')}</p>
          )}
          {!loading && query.trim().length < 2 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('landing.searchTooShort')}</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onMouseDown={() => goTo(r)}
              className="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-secondary/60"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {r.type === 'project' ? (
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                {r.title}
              </span>
              <span className="truncate text-xs text-muted-foreground">{r.snippet}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: typeof Zap;
  title: string;
  description: string;
  delay: number;
}) {
  const { ref, visible } = useRevealOnScroll();
  return (
    <div
      ref={ref}
      style={{ animationDelay: visible ? `${delay}ms` : undefined }}
      className={cn(
        'rounded-2xl border border-border bg-card/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_16px_40px_-20px_hsl(var(--primary)/0.4)]',
        visible ? 'animate-fade-up opacity-100' : 'opacity-0'
      )}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="mb-1.5 font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const t = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const primaryHref = user ? '/dashboard' : '/signup';
  const primaryLabel = user ? t('landing.ctaSignedIn') : t('landing.ctaSignedOut');

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">DOCLIX</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/blog"
            className="mr-1 hidden text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground sm:inline"
          >
            {t('nav.blog')}
          </Link>
          <button
            onClick={toggleTheme}
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          {user ? (
            <Link to="/dashboard">
              <Button variant="floating" size="sm">
                {t('nav.dashboard')}
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t('nav.signIn')}
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="floating" size="sm">
                  {t('nav.signUp')}
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-24 pt-16 text-center sm:px-6 sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.18),transparent_60%)]"
        />

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-1.5 text-xs font-medium text-muted-foreground animate-fade-up">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t('landing.badge')}
        </div>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl animate-fade-up" style={{ animationDelay: '80ms' }}>
          {t('landing.heading1')}
          <br />
          <span className="text-primary">{t('landing.heading2')}</span>
        </h1>

        <p
          className="mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg animate-fade-up"
          style={{ animationDelay: '160ms' }}
        >
          {t('landing.subheading')}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row animate-fade-up" style={{ animationDelay: '220ms' }}>
          <Link to={primaryHref}>
            <Button variant="floating" size="xl" className="animate-float-slow">
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button variant="floating-outline" size="xl">
              {t('landing.ctaSecondary')}
            </Button>
          </a>
        </div>

        <div className="mt-16 w-full animate-fade-up" style={{ animationDelay: '300ms' }}>
          <LiveSearchDemo />
          <p className="mt-3 text-xs text-muted-foreground">{t('landing.searchHint')}</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('landing.featuresHeading')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t('landing.featuresSubheading')}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Search}
            title={t('landing.features.search.title')}
            description={t('landing.features.search.description')}
            delay={0}
          />
          <FeatureCard
            icon={GitBranch}
            title={t('landing.features.reorder.title')}
            description={t('landing.features.reorder.description')}
            delay={80}
          />
          <FeatureCard
            icon={Zap}
            title={t('landing.features.autosave.title')}
            description={t('landing.features.autosave.description')}
            delay={160}
          />
          <FeatureCard
            icon={FileText}
            title={t('landing.features.importFile.title')}
            description={t('landing.features.importFile.description')}
            delay={240}
          />
          <FeatureCard
            icon={BookOpen}
            title={t('landing.features.publicByDefault.title')}
            description={t('landing.features.publicByDefault.description')}
            delay={320}
          />
          <FeatureCard
            icon={ArrowRight}
            title={t('landing.features.readyFast.title')}
            description={t('landing.features.readyFast.description')}
            delay={400}
          />
        </div>
      </section>

      {/* CTA footer */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-8 py-14 text-center sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--primary)/0.16),transparent_60%)]"
          />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('landing.footerCtaHeading')}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {t('landing.footerCtaSubheading')}
          </p>
          <div className="mt-7 flex justify-center">
            <Link to={primaryHref}>
              <Button variant="floating" size="xl">
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-2 border-t border-border px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
        <span>{t('landing.footerTagline')}</span>
        <Link to="/blog" className="transition-colors duration-150 hover:text-foreground">
          {t('landing.footerBlogLink')}
        </Link>
      </footer>
    </div>
  );
}
