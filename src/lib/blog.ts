export interface BlogPost {
  slug: string;
  title: string;
  date: string; // ISO date, e.g. '2026-07-20'
  summary: string;
  content: string;
}

interface Frontmatter {
  title?: string;
  date?: string;
  summary?: string;
}

function parseFrontmatter(raw: string): { data: Frontmatter; content: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const [, block, content] = match;
  const data: Frontmatter = {};
  for (const line of block.split('\n')) {
    const lineMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!lineMatch) continue;
    const [, key, rawValue] = lineMatch;
    const value = rawValue.trim().replace(/^["']|["']$/g, '');
    if (key === 'title' || key === 'date' || key === 'summary') {
      data[key] = value;
    }
  }
  return { data, content: content.trim() };
}

// Vite bundles every matching file at build time; each key is the file path.
const modules = import.meta.glob('/src/content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function slugFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.md$/, '');
}

export function getAllPosts(): BlogPost[] {
  const posts: BlogPost[] = Object.entries(modules).map(([path, raw]) => {
    const { data, content } = parseFrontmatter(raw as string);
    const slug = slugFromPath(path);
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? '1970-01-01',
      summary: data.summary ?? '',
      content,
    };
  });

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

export function formatPostDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
