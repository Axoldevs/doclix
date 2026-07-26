import { en, type Dictionary } from './en';

// Add an entry here once a language's UI strings have been filled in, e.g.:
//
//   import { pl } from './pl';
//   ...
//   pl,
//
// The `pl` module should export a `Dictionary`-shaped object with every key
// from en.ts translated. Until a language is added here, useTranslation()
// falls back to English for it automatically — the UI never shows blank or
// missing strings.
export const dictionaries: Partial<Record<string, Dictionary>> = {
  en,
};

export { en };
export type { Dictionary };
