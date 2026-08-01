/**
 * Import support for .md and .txt file uploads.
 *
 * Two outcomes:
 *  - Single section: the whole file becomes one section's content.
 *  - Split into sections: the file is divided at every top-level heading
 *    (a line starting with a single "# "), each becoming its own section
 *    titled after that heading. Anything before the first "# " heading
 *    becomes an optional leading "Introduction" section.
 *
 * .md files: markdown is passed through as-is (aside from line-ending
 * normalization). Splitting looks for literal "# " lines.
 *
 * .txt files: plain text has no markdown semantics, so a leading "# " is
 * just a section boundary marker, not a heading token. After determining
 * split points, the "# " marker itself is stripped from each piece (it
 * shouldn't render as a heading — the section title already carries that),
 * and the remaining text has markdown-significant characters escaped so it
 * renders visually unchanged.
 */

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB safety cap per file

export interface ImportedSection {
  title: string;
  content: string;
}

export interface ImportPreview {
  /** Fallback title derived from the filename, used when not splitting. */
  fileTitle: string;
  /** Whole-file content, escaped/normalized as appropriate — used when the user opts not to split. */
  singleContent: string;
  /** Sections detected via top-level "# " boundaries. Empty if no such heading was found. */
  detectedSections: ImportedSection[];
  isMarkdown: boolean;
}

export class FileImportError extends Error {}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function collapseExtraBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

function escapeMarkdownSyntax(text: string): string {
  // Escape leading markdown-significant characters per line, and inline
  // emphasis/code/strikethrough markers, so plain text doesn't get
  // reinterpreted as formatting.
  return text
    .split('\n')
    .map((line) => {
      // Escape literal backslashes FIRST. Plain text commonly contains
      // backslashes that were never meant as markdown escapes (Windows
      // paths like "C:\Users\name", regexes like "\d+", etc). If we don't
      // double them up here, the renderer's own escape handling later sees
      // e.g. "\*" in "C:\Users\*.txt" and treats it as an intentional
      // escape sequence, silently eating the backslash. Doubling it to
      // "\\*" makes the renderer emit a literal backslash followed by an
      // escaped "*", which is what the plain text actually meant.
      let escaped = line.replace(/\\/g, '\\\\');
      escaped = escaped.replace(/^(\s*)(#{1,6}\s|>\s|[-*]\s|\d+\.\s)/, (_m, ws, marker) => {
        return ws + '\\' + marker;
      });
      escaped = escaped.replace(/([*_~`[\]])/g, '\\$1');
      return escaped;
    })
    .join('\n');
}

function deriveTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.(md|markdown|txt)$/i, '');
  const spaced = withoutExt.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return 'Untitled';
  return spaced
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Matches a literal top-level heading line: "# Title" (not "##", "###", etc). */
const TOP_LEVEL_HEADING_RE = /^#(?!#)\s+(.+?)\s*$/;

/**
 * Splits normalized text at every top-level "# Heading" line.
 * Returns [] if there are zero or one such headings (nothing meaningful to split).
 */
function splitOnTopLevelHeadings(text: string): ImportedSection[] {
  const lines = text.split('\n');
  const headingIndices: { index: number; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TOP_LEVEL_HEADING_RE);
    if (match) headingIndices.push({ index: i, title: match[1].trim() });
  }

  if (headingIndices.length < 2) return [];

  const sections: ImportedSection[] = [];

  // Leading content before the first heading, if any non-blank text exists.
  const leading = lines.slice(0, headingIndices[0].index).join('\n').trim();
  if (leading.length > 0) {
    sections.push({ title: 'Introduction', content: leading });
  }

  for (let i = 0; i < headingIndices.length; i++) {
    const start = headingIndices[i].index + 1; // skip the heading line itself
    const end = i + 1 < headingIndices.length ? headingIndices[i + 1].index : lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    sections.push({ title: headingIndices[i].title, content: body });
  }

  return sections;
}

export function isSupportedImportFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
}

export async function buildImportPreview(file: File): Promise<ImportPreview> {
  if (!isSupportedImportFile(file)) {
    throw new FileImportError('Only .md and .txt files are supported.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileImportError('File is too large (max 2MB).');
  }

  const raw = await file.text();
  const normalized = normalizeLineEndings(raw);
  const isMarkdown = /\.(md|markdown)$/i.test(file.name);
  const fileTitle = deriveTitleFromFilename(file.name);

  if (isMarkdown) {
    const detected = splitOnTopLevelHeadings(normalized).map((s) => ({
      title: s.title,
      content: collapseExtraBlankLines(s.content).trim(),
    }));

    return {
      fileTitle,
      singleContent: collapseExtraBlankLines(normalized).trim(),
      detectedSections: detected,
      isMarkdown: true,
    };
  }

  // .txt: find split points on the raw text first (before escaping, since
  // escaping would neutralize the "# " marker we're splitting on), then
  // escape each resulting piece independently so its content renders as
  // plain text rather than markdown.
  const rawSections = splitOnTopLevelHeadings(normalized);
  const detected = rawSections.map((s) => ({
    title: s.title,
    content: collapseExtraBlankLines(escapeMarkdownSyntax(s.content)).trim(),
  }));

  return {
    fileTitle,
    singleContent: collapseExtraBlankLines(escapeMarkdownSyntax(normalized)).trim(),
    detectedSections: detected,
    isMarkdown: false,
  };
}
