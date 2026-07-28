// Cloudflare Pages Function: functions/docs/[[path]].ts
//
// Catch-all under /docs/*. Only intercepts requests ending in ".md" —
// e.g. /docs/my-project.md or /docs/my-project/getting-started.md —
// and serves the raw Markdown content straight from Supabase, with no
// HTML/app shell. This is the machine-readable counterpart advertised
// in /llms.txt, for AI crawlers and LLM tools that want plain content.
//
// Any /docs/* request NOT ending in ".md" falls through untouched, so
// the normal React app (DocProjectPage) continues to serve human
// visitors at /docs/:projectSlug and /docs/:projectSlug/:sectionSlug.
//
// A single [[path]].ts catch-all is used rather than filename-based
// dynamic segments like "[projectSlug].md.ts", because Cloudflare Pages'
// file-based routing only reliably strips the outer ".ts" extension —
// baking a literal ".md" into the routed path via the filename isn't a
// documented, guaranteed pattern. Parsing the path ourselves is robust.

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ASSETS: Fetcher;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const rawPath = params.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];

  const lastSegment = segments[segments.length - 1];
  const isMarkdownRequest =
    segments.length > 0 && segments.length <= 2 && !!lastSegment && lastSegment.endsWith('.md');

  if (!isMarkdownRequest) {
    // Not a .md request — this is a normal /docs/:projectSlug or
    // /docs/:projectSlug/:sectionSlug page view. Hand off to the static
    // asset server so the React app (DocProjectPage) renders as usual;
    // simply 404-ing here would NOT fall back automatically, since this
    // catch-all Function has already matched the route ("fail closed").
    return env.ASSETS.fetch(request);
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
