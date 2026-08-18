/**
 * Minimal Discord-style Markdown renderer.
 * Supports: bold, italic, underline, strikethrough, inline code, code blocks,
 * headings (# ## ###), bullet lists, numbered lists, blockquotes, links, hr.
 *
 * This is intentionally dependency-free and escapes HTML first to avoid
 * injection, then applies transformations in a safe order (block-level first,
 * then inline).
 */

export interface HeadingItem {
  level: 1 | 2 | 3;
  text: string;
  id: string;
}

// Characters that can be backslash-escaped per standard Markdown.
const ESCAPABLE_CHARS = '\\`*_{}[]()#+-.!>~|';

function slugifyHeading(text: string, seen: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function stripEscapes(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '\\' && next && ESCAPABLE_CHARS.includes(next)) {
      out += next;
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

export function extractHeadings(source: string): HeadingItem[] {
  const lines = source.split('\n');
  const seen = new Map<string, number>();
  const headings: HeadingItem[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^:::(box|columns)/.test(trimmed)) {
      inFence = true;
      continue;
    }
    if (inFence && trimmed === ':::') {
      inFence = false;
      continue;
    }
    if (inFence) continue;

    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h3) headings.push({ level: 3, text: stripEscapes(h3[1].trim()), id: slugifyHeading(h3[1], seen) });
    else if (h2) headings.push({ level: 2, text: stripEscapes(h2[1].trim()), id: slugifyHeading(h2[1], seen) });
    else if (h1) headings.push({ level: 1, text: stripEscapes(h1[1].trim()), id: slugifyHeading(h1[1], seen) });
  }

  return headings;
}

/**
 * Replace backslash-escaped markdown-significant characters (e.g. "\*",
 * "\_", "\#") with a placeholder token holding the literal character, so
 * later block/inline parsing doesn't treat it as syntax. Tokens are
 * resolved back to plain text at the very end of rendering.
 */
function protectEscapedChars(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '\\' && next && ESCAPABLE_CHARS.includes(next)) {
      out += `\u0000ESC${next.charCodeAt(0)}\u0000`;
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

function restoreEscapedChars(html: string): string {
  return html.replace(/\u0000ESC(\d+)\u0000/g, (_m, code) => {
    const ch = String.fromCharCode(Number(code));
    // The literal character may itself need HTML-escaping (e.g. "\<").
    return escapeHtml(ch);
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text: string): string {
  let out = text;

  // Inline code (protect content from further inline processing)
  const codeTokens: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_m, code) => {
    codeTokens.push(code);
    return `\u0000CODE${codeTokens.length - 1}\u0000`;
  });

  // Images ![alt](url) — must be handled before links, since the link
  // pattern would otherwise match the "[alt](url)" part and leave a stray "!".
  out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_m, alt, url) => {
    return `<img src="${url}" alt="${alt}" loading="lazy" />`;
  });

  // Links [text](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Underline __text__
  out = out.replace(/__([^_]+)__/g, '<u>$1</u>');
  // Strikethrough ~~text~~
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // Italic *text* (single asterisks, after bold has been consumed)
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Restore code tokens
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, i) => {
    return `<code>${escapeHtml(codeTokens[Number(i)])}</code>`;
  });

  return out;
}

export function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-') || !trimmed.includes('|')) return false;
  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length > 0 && cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
}

export function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

/**
 * Pull fenced code blocks out of the raw source BEFORE any HTML-escaping or
 * backslash-escape processing runs, so code content is never mistaken for
 * markdown syntax (e.g. a literal "\*" in a Windows path or regex inside a
 * code block must survive untouched, not get treated as an escape sequence).
 * Each block becomes a placeholder line; the real (HTML-escaped, otherwise
 * untouched) code is spliced back in at the end.
 */
function extractCodeBlocks(source: string): { text: string; blocks: { lang: string; code: string }[] } {
  const lines = source.split('\n');
  const blocks: { lang: string; code: string }[] = [];
  const outLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const idx = blocks.length;
      blocks.push({ lang, code: escapeHtml(codeLines.join('\n')) });
      outLines.push(`\u0000CODEBLOCK${idx}\u0000`);
    } else {
      outLines.push(line);
      i++;
    }
  }

  return { text: outLines.join('\n'), blocks };
}

export const BOX_COLORS = ['violet', 'blue', 'green', 'amber', 'red', 'gray'] as const;
export type BoxColor = (typeof BOX_COLORS)[number];

const BOX_COLOR_HEX: Record<BoxColor, string> = {
  violet: '#8b5cf6',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#6b7280',
};

function isBoxColor(value: string): value is BoxColor {
  return (BOX_COLORS as readonly string[]).includes(value);
}

/**
 * Pull ":::box" and ":::columns" fenced blocks out of the raw source BEFORE
 * escape processing, the same way extractCodeBlocks does, so their inner
 * content (which itself gets run back through renderMarkdown/renderInline)
 * doesn't get double-escaped by the outer pass.
 */
function extractCustomBlocks(source: string): {
  text: string;
  boxes: { color: BoxColor; title: string; body: string }[];
  columns: { left: string; right: string }[];
} {
  const lines = source.split('\n');
  const boxes: { color: BoxColor; title: string; body: string }[] = [];
  const columns: { left: string; right: string }[] = [];
  const outLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const boxOpen = line.trim().match(/^:::box(?:\s+(\S+))?(?:\s+"([^"]*)")?\s*$/);
    const columnsOpen = /^:::columns\s*$/.test(line.trim());

    if (boxOpen) {
      const colorArg = (boxOpen[1] || '').toLowerCase();
      const color: BoxColor = isBoxColor(colorArg) ? colorArg : 'violet';
      const title = boxOpen[2] || '';
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') {
        bodyLines.push(lines[i]);
        i++;
      }
      i++; // skip closing :::
      const idx = boxes.length;
      boxes.push({ color, title, body: bodyLines.join('\n') });
      outLines.push(`\u0000BOX${idx}\u0000`);
      continue;
    }

    if (columnsOpen) {
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') {
        bodyLines.push(lines[i]);
        i++;
      }
      i++; // skip closing :::
      const sepIdx = bodyLines.findIndex((l) => l.trim() === '---');
      const left = sepIdx === -1 ? bodyLines.join('\n') : bodyLines.slice(0, sepIdx).join('\n');
      const right = sepIdx === -1 ? '' : bodyLines.slice(sepIdx + 1).join('\n');
      const idx = columns.length;
      columns.push({ left, right });
      outLines.push(`\u0000COLUMNS${idx}\u0000`);
      continue;
    }

    outLines.push(line);
    i++;
  }

  return { text: outLines.join('\n'), boxes, columns };
}

export function renderMarkdown(source: string): string {
  const { text: withoutCustom, boxes, columns } = extractCustomBlocks(source);
  const { text: withoutCode, blocks: codeBlocks } = extractCodeBlocks(withoutCustom);
  const escaped = protectEscapedChars(escapeHtml(withoutCode));
  const lines = escaped.split('\n');

  const html: string[] = [];
  let i = 0;
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;
  const headingSlugSeen = new Map<string, number>();

  function slugForHeading(text: string): string {
    const base = text
      .toLowerCase()
      .trim()
      .replace(/&[a-z]+;/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    const count = headingSlugSeen.get(base) ?? 0;
    headingSlugSeen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  }

  function flushList() {
    if (!listBuffer) return;
    const tag = listBuffer.type;
    html.push(
      `<${tag}>${listBuffer.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`
    );
    listBuffer = null;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Restored code block placeholder — always wins, never treated as table/list/etc.
    const codeBlockMatch = line.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
    if (codeBlockMatch) {
      flushList();
      const block = codeBlocks[Number(codeBlockMatch[1])];
      html.push(
        `<pre><code${block.lang ? ` class="language-${block.lang}"` : ''}>${block.code}</code></pre>`
      );
      i++;
      continue;
    }

    // Restored box/callout placeholder.
    const boxMatch = line.match(/^\u0000BOX(\d+)\u0000$/);
    if (boxMatch) {
      flushList();
      const box = boxes[Number(boxMatch[1])];
      const hex = BOX_COLOR_HEX[box.color];
      const titleHtml = box.title
        ? `<div class="doclix-box-title">${renderInline(escapeHtml(box.title))}</div>`
        : '';
      html.push(
        `<div class="doclix-box doclix-box-${box.color}" style="--doclix-box-color:${hex}">${titleHtml}${renderMarkdown(
          box.body
        )}</div>`
      );
      i++;
      continue;
    }

    // Restored columns placeholder.
    const columnsMatch = line.match(/^\u0000COLUMNS(\d+)\u0000$/);
    if (columnsMatch) {
      flushList();
      const col = columns[Number(columnsMatch[1])];
      html.push(
        `<div class="doclix-columns"><div class="doclix-column">${renderMarkdown(
          col.left
        )}</div><div class="doclix-column">${renderMarkdown(col.right)}</div></div>`
      );
      i++;
      continue;
    }

    // Tables: header row, separator row (---|---), then body rows
    if (line.trim().includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
      flushList();
      const headerCells = splitTableRow(line);
      const alignCells = splitTableRow(lines[i + 1]).map((c) => {
        const left = c.startsWith(':');
        const right = c.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return '';
      });
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }

      const alignStyle = (idx: number) =>
        alignCells[idx] ? ` style="text-align:${alignCells[idx]}"` : '';

      const thead = `<thead><tr>${headerCells
        .map((c, idx) => `<th${alignStyle(idx)}>${renderInline(c)}</th>`)
        .join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${row.map((c, idx) => `<td${alignStyle(idx)}>${renderInline(c)}</td>`).join('')}</tr>`
        )
        .join('')}</tbody>`;

      html.push(`<div class="doclix-table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      flushList();
      html.push('<hr />');
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h3) {
      flushList();
      html.push(`<h3 id="${slugForHeading(h3[1])}">${renderInline(h3[1])}</h3>`);
      i++;
      continue;
    }
    if (h2) {
      flushList();
      html.push(`<h2 id="${slugForHeading(h2[1])}">${renderInline(h2[1])}</h2>`);
      i++;
      continue;
    }
    if (h1) {
      flushList();
      html.push(`<h1 id="${slugForHeading(h1[1])}">${renderInline(h1[1])}</h1>`);
      i++;
      continue;
    }

    // Blockquote
    const bq = line.match(/^&gt;\s?(.*)/);
    if (bq) {
      flushList();
      const quoteLines = [bq[1]];
      i++;
      while (i < lines.length) {
        const next = lines[i].match(/^&gt;\s?(.*)/);
        if (!next) break;
        quoteLines.push(next[1]);
        i++;
      }
      html.push(`<blockquote>${quoteLines.map((l) => renderInline(l)).join('<br/>')}</blockquote>`);
      continue;
    }

    // Numbered list
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ol) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(ol[1]);
      i++;
      continue;
    }

    // Bullet list
    const ul = line.match(/^[-*]\s+(.*)/);
    if (ul) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(ul[1]);
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      flushList();
      i++;
      continue;
    }

    // Paragraph
    flushList();
    html.push(`<p>${renderInline(line)}</p>`);
    i++;
  }

  flushList();
  return restoreEscapedChars(html.join('\n'));
}
