// Thin client for the free MyMemory translation API
// (https://mymemory.translated.net/doc/spec.php).

const COOKIE_NAME = 'doclix_lang';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

/** Two-letter-ish language code, preferring a saved cookie, falling back to the browser's language. */
export function getPreferredLanguage(): string {
  const cookie = getCookie(COOKIE_NAME);
  if (cookie) return cookie;
  const nav = navigator.language || 'en';
  return nav.split('-')[0];
}

export function setPreferredLanguage(lang: string) {
  setCookie(COOKIE_NAME, lang);
}

export const COMMON_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polish' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ru', label: 'Russian' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
];

const MYMEMORY_MAX_CHARS = 490; // MyMemory truncates long queries; stay under its per-request limit

function chunkText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split on the last sentence/paragraph boundary before maxLen
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf('. ', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf(' ', maxLen);
    if (splitAt < 1) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt + 1));
    remaining = remaining.slice(splitAt + 1);
  }
  return chunks;
}

async function translateChunk(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
  if (!text.trim()) return text;
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
  });
  const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
  if (!res.ok) throw new Error('Translation request failed.');
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error('Translation service returned no result.');
  return translated;
}

/** Translates (possibly long) text via MyMemory, chunking to respect its length limit. */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = 'en'
): Promise<string> {
  if (targetLang === sourceLang) return text;
  const chunks = chunkText(text, MYMEMORY_MAX_CHARS);
  const translated = await Promise.all(chunks.map((c) => translateChunk(c, targetLang, sourceLang)));
  return translated.join('');
}
