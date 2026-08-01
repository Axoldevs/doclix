import { useEffect, useRef, useState } from 'react';

export interface BlogSearchResult {
  type: 'blog';
  id: string;
  title: string;
  snippet: string;
  slug: string;
}

let cachedSlugs: string[] | null = null;
let inflightFetch: Promise<string[]> | null = null;

function humanizeSlug(slug: string): string {
  // Blog slugs are `{date}-{title}`, e.g. 2026-07-26-new-landing-page.
  const withoutDate = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return withoutDate
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

// Blog post URLs are read from the live sitemap rather than the local
// markdown glob, so search reflects exactly what's published/discoverable
// (see functions/sitemap.xml.ts, the source of truth for blog routes).
async function fetchBlogSlugs(): Promise<string[]> {
  if (cachedSlugs) return cachedSlugs;
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    try {
      const res = await fetch('/sitemap.xml');
      if (!res.ok) return [];
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const locs = Array.from(doc.getElementsByTagName('loc')).map((el) => el.textContent ?? '');
      const slugs = locs
        .map((loc) => loc.match(/\/blog\/([^/]+)\/?$/)?.[1])
        .filter((slug): slug is string => Boolean(slug));
      cachedSlugs = slugs;
      return slugs;
    } catch {
      return [];
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

export function useBlogSitemapSearch(query: string) {
  const [results, setResults] = useState<BlogSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    fetchBlogSlugs().then((slugs) => {
      if (requestId !== requestIdRef.current) return;
      const q = trimmed.toLowerCase();
      const matched = slugs
        .filter((slug) => slug.toLowerCase().includes(q.replace(/\s+/g, '-')) || humanizeSlug(slug).toLowerCase().includes(q))
        .map((slug) => ({
          type: 'blog' as const,
          id: slug,
          title: humanizeSlug(slug),
          snippet: 'Blog post',
          slug,
        }));
      setResults(matched);
      setLoading(false);
    });
  }, [query]);

  return { results, loading };
}
