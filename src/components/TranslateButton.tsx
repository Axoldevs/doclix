import { useEffect, useRef, useState } from 'react';
import { Languages, Check, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COMMON_LANGUAGES,
  getPreferredLanguage,
  setPreferredLanguage,
  translateText,
} from '@/lib/translate';

interface TranslateButtonProps {
  /** Original markdown/plain text to translate. */
  sourceText: string;
  /** Called with translated text, or null to reset back to the original. */
  onTranslated: (text: string | null) => void;
  disabled?: boolean;
  /**
   * Restrict the offered languages to this list of codes (project owner's
   * "Localization" setting). Omitted or empty means "no restriction" --
   * every COMMON_LANGUAGES entry is offered, same as before this prop
   * existed.
   */
  enabledLanguages?: string[];
}

export function TranslateButton({ sourceText, onTranslated, disabled, enabledLanguages }: TranslateButtonProps) {
  const [open, setOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reflect the saved preferred language whenever the underlying content
  // changes (e.g. navigating sections), so the button doesn't visually
  // reset to "Original" while the page is actually showing a translation.
  useEffect(() => {
    const preferred = getPreferredLanguage();
    setActiveLang(preferred === 'en' ? null : preferred);
    setError(null);
  }, [sourceText]);

  async function handleSelect(langCode: string) {
    setOpen(false);
    setError(null);

    if (langCode === 'en') {
      setActiveLang(null);
      onTranslated(null);
      return;
    }

    setLoading(true);
    try {
      const translated = await translateText(sourceText, langCode, 'en');
      setActiveLang(langCode);
      setPreferredLanguage(langCode);
      onTranslated(translated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setLoading(false);
    }
  }

  const preferred = getPreferredLanguage();
  const activeLabel = COMMON_LANGUAGES.find((l) => l.code === activeLang)?.label;
  const offeredLanguages =
    enabledLanguages && enabledLanguages.length > 0
      ? COMMON_LANGUAGES.filter((l) => enabledLanguages.includes(l.code))
      : COMMON_LANGUAGES;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition-colors duration-200',
          'hover:bg-secondary/50 disabled:pointer-events-none disabled:opacity-50',
          activeLang && 'border-primary/40 bg-primary/10 text-primary'
        )}
        title="Translate this content"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Languages className="h-3.5 w-3.5" />
        )}
        {activeLabel ?? 'Translate'}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-72 w-48 overflow-y-auto scrollbar-thin rounded-lg border border-border bg-card p-1 shadow-xl">
          <button
            onClick={() => handleSelect('en')}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-secondary/60"
          >
            Original (English)
            {!activeLang && <Check className="h-3 w-3 text-primary" />}
          </button>
          <div className="my-1 h-px bg-border" />
          {offeredLanguages.filter((l) => l.code !== 'en').map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-secondary/60',
                lang.code === preferred && 'font-medium'
              )}
            >
              {lang.label}
              {activeLang === lang.code && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="absolute right-0 top-full mt-1 w-48 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
