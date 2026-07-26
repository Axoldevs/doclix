import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getPreferredLanguage, setPreferredLanguage, COMMON_LANGUAGES } from '@/lib/translate';
import { dictionaries, en, type Dictionary } from '@/lib/i18n/dictionaries';

type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every valid translation key, e.g. 'nav.blog' or 'landing.ctaSignedOut'. */
export type TranslationKey = DotPaths<Dictionary>;

function lookup(dict: Dictionary, path: string): string | undefined {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dict;
  for (const part of parts) {
    if (value == null) return undefined;
    value = value[part];
  }
  return typeof value === 'string' ? value : undefined;
}

interface LanguageContextValue {
  /** Current whole-site UI language code, e.g. 'en', 'pl', 'es'. */
  language: string;
  /** Change the site-wide UI language. Shares the same saved preference as the per-section translate button. */
  setLanguage: (code: string) => void;
  /** Every language the app can offer (same list used for per-section doc content translation). */
  availableLanguages: typeof COMMON_LANGUAGES;
  /** Whether the current language has real UI translations, or is silently falling back to English. */
  hasTranslations: boolean;
  /** Look up a UI string by its dot-path key, falling back to English if the current language isn't filled in yet. */
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(() => getPreferredLanguage());

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    setPreferredLanguage(code);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = dictionaries[language];
      const value = (dict && lookup(dict, key)) ?? lookup(en, key);
      return value ?? key;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages: COMMON_LANGUAGES,
      hasTranslations: language === 'en' || dictionaries[language] !== undefined,
      t,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

/** Convenience hook for components that only need the t() function. */
export function useTranslation() {
  return useLanguage().t;
}

export { COMMON_LANGUAGES };
