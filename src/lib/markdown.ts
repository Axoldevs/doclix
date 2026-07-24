/**
 * Minimal Discord-style Markdown renderer.
 * Supports: bold, italic, underline, strikethrough, inline code, code blocks,
 * headings (# ## ###), bullet lists, numbered lists, blockquotes, links, hr.
 *
 * This is intentionally dependency-free and escapes HTML first to avoid
 * injection, then applies transformations in a safe order (block-level first,
 * then inline).
 */

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

export function renderMarkdown(source: string): string {
  const escaped = escapeHtml(source);
  const lines = escaped.split('\n');

  const html: string[] = [];
  let i = 0;
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;

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

    // Code block ```lang ... ```
    if (/^```/.test(line.trim())) {
      flushList();
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      html.push(
        `<pre><code${lang ? ` class="language-${lang}"` : ''}>${codeLines.join('\n')}</code></pre>`
      );
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
      html.push(`<h3>${renderInline(h3[1])}</h3>`);
      i++;
      continue;
    }
    if (h2) {
      flushList();
      html.push(`<h2>${renderInline(h2[1])}</h2>`);
      i++;
      continue;
    }
    if (h1) {
      flushList();
      html.push(`<h1>${renderInline(h1[1])}</h1>`);
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
  return html.join('\n');
}
