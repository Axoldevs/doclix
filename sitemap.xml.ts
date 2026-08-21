// Cloudflare Pages Function: /sitemap.xml
//
// Generates a sitemap covering the static marketing/app routes plus every
// public project and section stored in Supabase, so search engines and
// LLM crawlers can discover individual doc sites without a rebuild each
// time a project or section is added.
//
// Uses the same SUPABASE_URL / SUPABASE_ANON_KEY secrets as
// functions/api/config.ts. Read access to projects/sections is public
// (RLS allows select on all rows), matching the behavior of global search.

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const SITE_URL = 'https://doclix.pages.dev';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc: string, changefreq: string, priority: string, lastmod?: string) {
  return `  <url>
    <loc>${xmlEscape(loc)}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// Blog posts are static .md files under src/content/blog/, bundled into
// the app at build time via import.meta.glob (see src/lib/blog.ts). That
// Vite-only API isn't available in the Pages Functions runtime, which
// builds and runs separately from the Vite app, so post slugs and dates
// are listed here instead. Keep this in sync with src/content/blog/ —
// each filename is `{date}-{slug}.md` and IS the slug used in
// BlogPostPage's route (see src/pages/BlogPostPage.tsx / blog.ts
// slugFromPath, which keeps the date prefix as part of the slug).
const BLOG_POSTS: Array<{ slug: string; date: string }> = [
  { slug: '2026-07-10-search-was-always-the-point', date: '2026-07-10' },
  { slug: '2026-07-26-new-landing-page', date: '2026-07-26' },
  { slug: '2026-08-01-smarter-search-and-floating-nav', date: '2026-08-01' },
  { slug: '2026-08-19-highlight-hotfix', date: '2026-08-19' },
  { slug: '2026-08-21-editor-redesign', date: '2026-08-21' },
];

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // lastmod for the static/blog-list pages: use the newest blog post date
  // as a stand-in for "most recently changed," since these routes aren't
  // backed by a row with its own updated_at.
  const latestBlogDate = BLOG_POSTS.reduce(
    (latest, p) => (p.date > latest ? p.date : latest),
    BLOG_POSTS[0]?.date ?? new Date().toISOString().slice(0, 10)
  );

  const entries: string[] = [
    urlEntry(`${SITE_URL}/`, 'weekly', '1.0', latestBlogDate),
    urlEntry(`${SITE_URL}/blog`, 'weekly', '0.6', latestBlogDate),
    urlEntry(`${SITE_URL}/login`, 'monthly', '0.4'),
    urlEntry(`${SITE_URL}/signup`, 'monthly', '0.5'),
    urlEntry(`${SITE_URL}/dashboard`, 'monthly', '0.3'),
    ...BLOG_POSTS.map((p) => urlEntry(`${SITE_URL}/blog/${p.slug}`, 'monthly', '0.5', p.date)),
  ];

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const headers = {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      };

      // Guard against a slow/hanging Supabase response stalling the whole
      // function (Cloudflare Pages Functions can hang until the platform's
      // own execution limit kills them, which can make crawlers like
      // Googlebot see the fetch as failed entirely). Bail out to the
      // static-only sitemap after 3s instead.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const [projectsRes, sectionsRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/projects?select=slug,updated_at`, {
          headers,
          signal: controller.signal,
        }),
        fetch(`${supabaseUrl}/rest/v1/sections?select=slug,updated_at,projects!inner(slug)`, {
          headers,
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeout);

      if (projectsRes.ok) {
        const projects: Array<{ slug: string; updated_at?: string }> = await projectsRes.json();
        for (const p of projects) {
          entries.push(
            urlEntry(
              `${SITE_URL}/docs/${p.slug}`,
              'weekly',
              '0.8',
              p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : undefined
            )
          );
        }
      }

      if (sectionsRes.ok) {
        const sections: Array<{
          slug: string;
          updated_at?: string;
          projects?: { slug: string } | { slug: string }[];
        }> = await sectionsRes.json();
        for (const s of sections) {
          const projectSlug = Array.isArray(s.projects) ? s.projects[0]?.slug : s.projects?.slug;
          if (!projectSlug) continue;
          entries.push(
            urlEntry(
              `${SITE_URL}/docs/${projectSlug}/${s.slug}`,
              'weekly',
              '0.7',
              s.updated_at ? new Date(s.updated_at).toISOString().slice(0, 10) : undefined
            )
          );
        }
      }
    } catch {
      // If Supabase is unreachable, fall back to just the static routes
      // above rather than failing the whole sitemap request.
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
