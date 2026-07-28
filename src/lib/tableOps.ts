import { isTableSeparatorRow, splitTableRow } from '@/lib/markdown';

export interface TableBlock {
  startLine: number; // index of header row line
  endLine: number; // index of last body row line (inclusive)
  lines: string[]; // raw lines: [header, separator, ...body]
  colCount: number;
  cursorLineIndex: number; // which line (relative to file) the cursor is on
  cursorCol: number; // which column index the cursor is in
}

function lineBounds(lineIndex: number, allLines: string[]) {
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) offset += allLines[i].length + 1;
  return { start: offset, end: offset + allLines[lineIndex].length };
}

export function findTableAtCursor(value: string, cursorPos: number): TableBlock | null {
  const lines = value.split('\n');
  let offset = 0;
  let cursorLineIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = offset + lines[i].length;
    if (cursorPos <= lineEnd) {
      cursorLineIndex = i;
      break;
    }
    offset = lineEnd + 1;
    cursorLineIndex = i;
  }

  // Search outward from the cursor line for a header+separator pair, then
  // collect contiguous table rows around it.
  let headerLine = -1;
  for (let i = cursorLineIndex; i >= 0; i--) {
    if (i + 1 < lines.length && lines[i].includes('|') && isTableSeparatorRow(lines[i + 1])) {
      headerLine = i;
      break;
    }
    if (i < cursorLineIndex && (!lines[i].includes('|') || lines[i].trim() === '')) break;
  }
  if (headerLine === -1) return null;
  if (cursorLineIndex < headerLine) return null;

  let endLine = headerLine + 1; // separator row
  while (endLine + 1 < lines.length && lines[endLine + 1].trim().includes('|') && lines[endLine + 1].trim() !== '') {
    endLine++;
  }
  if (cursorLineIndex > endLine) return null;

  const colCount = splitTableRow(lines[headerLine]).length;

  const cursorLineStart = lineBounds(cursorLineIndex, lines).start;
  const before = value.slice(cursorLineStart, cursorPos);
  const cursorCol = Math.max(0, (before.match(/\|/g) || []).length - (lines[cursorLineIndex].trim().startsWith('|') ? 1 : 0));

  return {
    startLine: headerLine,
    endLine,
    lines: lines.slice(headerLine, endLine + 1),
    colCount,
    cursorLineIndex,
    cursorCol: Math.min(cursorCol, colCount - 1),
  };
}

export function addTableRow(value: string, cursorPos: number): { newValue: string; cursorPos: number } | null {
  const table = findTableAtCursor(value, cursorPos);
  if (!table) return null;

  const lines = value.split('\n');
  const header = splitTableRow(table.lines[0]);
  const newRow = header.map(() => ' ');

  // Insert after the current row, or after the header/separator if cursor is there.
  const insertAfterAbsoluteLine = Math.max(table.cursorLineIndex, table.startLine + 1);
  const before = lines.slice(0, insertAfterAbsoluteLine + 1);
  const after = lines.slice(insertAfterAbsoluteLine + 1);
  const newLine = `| ${newRow.join(' | ')} |`;
  const newLines = [...before, newLine, ...after];
  const newValue = newLines.join('\n');
  const newCursorPos = before.join('\n').length + 1 + 2; // start of new row, inside first cell

  return { newValue, cursorPos: newCursorPos };
}

export function removeTableRow(value: string, cursorPos: number): { newValue: string; cursorPos: number } | null {
  const table = findTableAtCursor(value, cursorPos);
  if (!table) return null;
  // Can't remove header or separator row.
  if (table.cursorLineIndex <= table.startLine + 1) return null;
  if (table.endLine <= table.startLine + 2) return null; // keep at least one body row

  const lines = value.split('\n');
  const newLines = [...lines.slice(0, table.cursorLineIndex), ...lines.slice(table.cursorLineIndex + 1)];
  const newValue = newLines.join('\n');
  const newCursorPos = lines.slice(0, table.cursorLineIndex).join('\n').length + 1;

  return { newValue, cursorPos: Math.min(newCursorPos, newValue.length) };
}

export function addTableColumn(value: string, cursorPos: number): { newValue: string; cursorPos: number } | null {
  const table = findTableAtCursor(value, cursorPos);
  if (!table) return null;

  const lines = value.split('\n');
  const tableLines = lines.slice(table.startLine, table.endLine + 1);

  const newTableLines = tableLines.map((line, idx) => {
    if (idx === 1) {
      // separator row
      const cells = splitTableRow(line);
      cells.push('---');
      return `| ${cells.join(' | ')} |`;
    }
    const cells = splitTableRow(line);
    cells.push(idx === 0 ? `Column ${cells.length + 1}` : ' ');
    return `| ${cells.join(' | ')} |`;
  });

  const newLines = [...lines.slice(0, table.startLine), ...newTableLines, ...lines.slice(table.endLine + 1)];
  const newValue = newLines.join('\n');

  return { newValue, cursorPos };
}

export function removeTableColumn(value: string, cursorPos: number): { newValue: string; cursorPos: number } | null {
  const table = findTableAtCursor(value, cursorPos);
  if (!table) return null;
  if (table.colCount <= 1) return null;

  const lines = value.split('\n');
  const tableLines = lines.slice(table.startLine, table.endLine + 1);
  const colToRemove = table.cursorCol;

  const newTableLines = tableLines.map((line) => {
    const cells = splitTableRow(line);
    cells.splice(colToRemove, 1);
    return `| ${cells.join(' | ')} |`;
  });

  const newLines = [...lines.slice(0, table.startLine), ...newTableLines, ...lines.slice(table.endLine + 1)];
  const newValue = newLines.join('\n');

  return { newValue, cursorPos };
}
