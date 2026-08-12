// Cloudflare Pages Function: functions/docs/[[path]].ts
//
// Catch-all under /docs/*. Only intercepts requests ending in ".md" —
// e.g. /docs/my-project.md or /docs/my-project/getting-started.md —
// and serves the raw Markdown content straight from Supabase, with no
// HTML/app shell. This is the machine-readable counterpart advertised
// in /llms.txt, for AI crawlers and LLM tools that want plain content.
//
// Any /docs/* request NOT ending in ".md" falls through to renderDocShell,
// which now does two things instead of just meta-tag swapping:
//   1. real per-page <title>/<meta description>/OG tags (as before)
//   2. the active section's Markdown, rendered server-side with the same
//      renderMarkdown() the client uses, injected straight into #root
// so a phone on 3G gets actual readable content in the first HTML
// response — no waiting on the JS bundle to download, parse, fetch
// runtime config, fetch data, and render. React still boots normally
// afterwards and replaces #root's contents with the live app (via
// createRoot, not hydrateRoot, so this is a plain swap, not a hydration
// mismatch) — the pre-rendered markup is purely a fast-paint placeholder
// that happens to be the real content instead of a blank div or spinner.
//
// A single [[path]].ts catch-all is used rather than filename-based
// dynamic segments like "[projectSlug].md.ts", because Cloudflare Pages'
// file-based routing only reliably strips the outer ".ts" extension —
// baking a literal ".md" into the routed path via the filename isn't a
// documented, guaranteed pattern. Parsing the path ourselves is robust.

import { renderMarkdown } from '../../src/lib/markdown';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ASSETS: Fetcher;
}

const SITE_URL = 'https://doclix.pages.dev';

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Trim a description down to a sane meta-description length without
// cutting mid-word.
function truncateDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

async function renderDocShell(
  env: Env,
  params: Record<string, string | string[]>,
  request: Request
): Promise<Response> {
  // Always fetch the built app shell first; if anything below fails we
  // fall back to serving it untouched rather than breaking the page.
  const shellRes = await env.ASSETS.fetch(request);
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !shellRes.ok) {
    return shellRes;
  }

  const rawPath = params.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const [projectSlug, sectionSlug] = segments;
  if (!projectSlug) return shellRes;

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };

  try {
    const projectRes = await fetch(
      `${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(
        projectSlug
      )}&select=id,title,description`,
      { headers }
    );
    if (!projectRes.ok) return shellRes;

    const projects: Array<{ id: string; title: string; description: string | null }> =
      await projectRes.json();
    const project = projects[0];
    if (!project) return shellRes;

    let pageTitle = `${project.title} | DOCLIX`;
    let description = project.description ? truncateDescription(project.description) : `${project.title} documentation on DOCLIX.`;
    const canonicalPath = sectionSlug ? `/docs/${projectSlug}/${sectionSlug}` : `/docs/${projectSlug}`;

    // Fetch whichever section should render: the requested one, or (when
    // no sectionSlug is in the URL) the project's first section — same
    // "default to sections[0]" rule DocProjectPage uses client-side, so
    // the pre-rendered content matches what React would show anyway.
    let renderedContentHtml = '';
    const sectionFilter = sectionSlug
      ? `project_id=eq.${project.id}&slug=eq.${encodeURIComponent(sectionSlug)}`
      : `project_id=eq.${project.id}&order=position.asc&limit=1`;
    const sectionRes = await fetch(
      `${supabaseUrl}/rest/v1/sections?${sectionFilter}&select=title,content`,
      { headers }
    );
    if (sectionRes.ok) {
      const sectionsData: Array<{ title: string; content: string }> = await sectionRes.json();
      const section = sectionsData[0];
      if (section) {
        pageTitle = `${section.title} | ${project.title} | DOCLIX`;
        const plainText = (section.content ?? '')
          .replace(/```[\s\S]*?```/g, ' ')
          .replace(/[#*`_>\-\[\]()!]/g, ' ');
        description = plainText.trim() ? truncateDescription(plainText) : description;

        try {
          renderedContentHtml =
            renderMarkdown(section.content ?? '', projectSlug) ||
            '<p class="text-muted-foreground">This section has no content yet.</p>';
        } catch {
          // If rendering fails for any reason, fall back to no
          // pre-rendered content rather than breaking the whole page —
          // React will still fill it in client-side as before.
          renderedContentHtml = '';
        }
      }
    }

    let html = await shellRes.text();

    if (renderedContentHtml) {
      html = html.replace(
        '<div id="root"></div>',
        `<div id="root"><div class="doclix-prerender"><div class="doclix-prose" data-no-translate>${renderedContentHtml}</div></div></div>`
      );
    }
    html = html
      .replace(/<title>.*?<\/title>/s, `<title>${htmlEscape(pageTitle)}</title>`)
      .replace(
        /<meta name="description" content=".*?"\s*\/>/s,
        `<meta name="description" content="${htmlEscape(description)}" />`
      );

    // Canonical link and Open Graph tags aren't in index.html at all yet,
    // so add them right before </head> rather than trying to replace
    // something that doesn't exist.
    const extraTags = [
      `<link rel="canonical" href="${htmlEscape(SITE_URL + canonicalPath)}" />`,
      `<meta property="og:title" content="${htmlEscape(pageTitle)}" />`,
      `<meta property="og:description" content="${htmlEscape(description)}" />`,
      `<meta property="og:url" content="${htmlEscape(SITE_URL + canonicalPath)}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta name="twitter:card" content="summary" />`,
    ].join('\n    ');
    html = html.replace('</head>', `    ${extraTags}\n  </head>`);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return shellRes;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const rawPath = params.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];

  const lastSegment = segments[segments.length - 1];
  const isMarkdownRequest =
    segments.length > 0 && segments.length <= 2 && !!lastSegment && lastSegment.endsWith('.md');

  if (!isMarkdownRequest) {
    // Not a .md request — this is a normal /docs/:projectSlug or
    // /docs/:projectSlug/:sectionSlug page view, served to human
    // visitors and to Googlebot. We still need real per-page <title>
    // and <meta description> in the initial HTML response (not just
    // set client-side after React hydrates), so search snippets show
    // the actual doc title/description instead of the generic DOCLIX
    // ones baked into index.html. Fetch the underlying app shell, swap
    // in the right meta tags, and return that instead of the raw shell.
    return renderDocShell(env, params, request);
  }

  const projectSlugSegment = segments[0];
  // When there's only one segment, it's the project slug with ".md"
  // stripped; when there are two, the second is the section slug with
  // ".md" stripped and the first is the plain project slug.
  const cleanProjectSlug = segments.length === 2 ? projectSlugSegment : projectSlugSegment.slice(0, -3);
  const cleanSectionSlug = segments.length === 2 ? segments[1].slice(0, -3) : undefined;

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Server is missing Supabase configuration.', { status: 500 });
  }

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };

  const projectRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(
      cleanProjectSlug
    )}&select=id,title,description`,
    { headers }
  );

  if (!projectRes.ok) return new Response('Failed to load project.', { status: 502 });

  const projects: Array<{ id: string; title: string; description: string | null }> =
    await projectRes.json();
  const project = projects[0];
  if (!project) return new Response('Not found', { status: 404 });

  const markdownHeaders = {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  };

  // Whole-project request: /docs/{projectSlug}.md
  if (!cleanSectionSlug) {
    const sectionsRes = await fetch(
      `${supabaseUrl}/rest/v1/sections?project_id=eq.${project.id}&select=title,content&order=position.asc`,
      { headers }
    );
    const sections: Array<{ title: string; content: string }> = sectionsRes.ok
      ? await sectionsRes.json()
      : [];

    const parts = [`# ${project.title}`];
    if (project.description) parts.push(project.description);
    for (const s of sections) {
      parts.push(`\n---\n\n## ${s.title}\n\n${s.content ?? ''}`);
    }

    return new Response(parts.join('\n\n'), { status: 200, headers: markdownHeaders });
  }

  // Single-section request: /docs/{projectSlug}/{sectionSlug}.md
  const sectionRes = await fetch(
    `${supabaseUrl}/rest/v1/sections?project_id=eq.${project.id}&slug=eq.${encodeURIComponent(
      cleanSectionSlug
    )}&select=title,content`,
    { headers }
  );

  if (!sectionRes.ok) return new Response('Failed to load section.', { status: 502 });

  const sectionsData: Array<{ title: string; content: string }> = await sectionRes.json();
  const section = sectionsData[0];
  if (!section) return new Response('Not found', { status: 404 });

  const markdown = `# ${section.title}\n\n_from ${project.title}_\n\n${section.content ?? ''}`;

  return new Response(markdown, { status: 200, headers: markdownHeaders });
};
