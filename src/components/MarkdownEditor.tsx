import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Table2,
  Minus,
  Undo2,
  Redo2,
  Eye,
  Columns2,
  Pencil,
  Check,
  Loader2,
  AlertCircle,
  Upload,
  ImagePlus,
  Code2,
  History,
  MessageSquare,
  Rows3,
  Columns3,
  RowsIcon,
  Square,
  Columns,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderMarkdown, type BoxColor } from '@/lib/markdown';
import { useHistory } from '@/hooks/useHistory';
import { useAutoSave, type SaveStatus } from '@/hooks/useAutoSave';
import { buildImportPreview, isSupportedImportFile, FileImportError } from '@/lib/fileImport';
import { useToast } from '@/contexts/ToastContext';
import { LinkDialog } from '@/components/LinkDialog';
import { TableDialog } from '@/components/TableDialog';
import { ImageDialog } from '@/components/ImageDialog';
import { CodeBlockDialog } from '@/components/CodeBlockDialog';
import { BoxDialog } from '@/components/BoxDialog';
import { HistoryDialog } from '@/components/HistoryDialog';
import { CommentsPanel } from '@/components/CommentsPanel';
import { TocPanel } from '@/components/TocPanel';
import { addTableRow, removeTableRow, addTableColumn, removeTableColumn, findTableAtCursor } from '@/lib/tableOps';
import type { MentionableUser } from '@/lib/mentions';
import type { Project, ProjectRole, Section } from '@/types/database';

type ViewMode = 'edit' | 'split' | 'preview';

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<{ error: string | null }>;
  readOnly?: boolean;
  sectionId?: string;
  isOwner?: boolean;
  project?: Project | null;
  section?: Section | null;
  role?: ProjectRole;
  mentionCandidates?: MentionableUser[];
  saveLabel?: string;
}

interface Transform {
  newValue: string;
  cursorStart: number;
  cursorEnd: number;
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string = before): Transform {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const newValue = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  return { newValue, cursorStart: selectionStart + before.length, cursorEnd: selectionEnd + before.length };
}

function prefixLines(textarea: HTMLTextAreaElement, prefix: string): Transform {
  const { selectionStart, selectionEnd, value } = textarea;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  let lineEnd = value.indexOf('\n', selectionEnd);
  if (lineEnd === -1) lineEnd = value.length;

  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : prefix + line))
    .join('\n');

  const newValue = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
  return { newValue, cursorStart: lineStart, cursorEnd: lineStart + prefixed.length };
}

function insertBlockAtCursor(textarea: HTMLTextAreaElement, block: string): Transform {
  const { selectionStart, selectionEnd, value } = textarea;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const leadPad = before.length === 0 ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trailPad = after.startsWith('\n') ? '' : '\n';
  const insertText = `${leadPad}${block}${trailPad}`;
  const newValue = before + insertText + after;
  const cursorStart = before.length + leadPad.length;
  const cursorEnd = cursorStart + block.length;
  return { newValue, cursorStart, cursorEnd };
}

function ToolGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30',
        active
          ? 'bg-secondary text-foreground'
          : accent
            ? 'text-primary hover:bg-primary/10'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ViewModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 transition-colors duration-150',
        active ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function saveStatusLabel(status: SaveStatus) {
  switch (status) {
    case 'saving':
      return { icon: Loader2, text: 'Saving…', spin: true, className: 'text-muted-foreground' };
    case 'saved':
      return { icon: Check, text: 'Saved', spin: false, className: 'text-green-400' };
    case 'error':
      return { icon: AlertCircle, text: 'Save failed — retrying', spin: false, className: 'text-destructive' };
    default:
      return { icon: Check, text: 'Up to date', spin: false, className: 'text-muted-foreground' };
  }
}

export function MarkdownEditor({
  initialContent,
  onSave,
  readOnly,
  sectionId,
  isOwner,
  project,
  section,
  role,
  mentionCandidates,
  saveLabel,
}: MarkdownEditorProps) {
  const { value, setValue, undo, redo, reset, canUndo, canRedo } = useHistory(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>(readOnly ? 'preview' : 'split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { status, saveNow } = useAutoSave(value, onSave);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInitialText, setLinkInitialText] = useState('');
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [boxDialogOpen, setBoxDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const [tableContext, setTableContext] = useState(false);

  useEffect(() => {
    reset(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  const applyTransform = useCallback(
    (transform: (ta: HTMLTextAreaElement) => Transform) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const { newValue, cursorStart, cursorEnd } = transform(ta);
      setValue(newValue);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursorStart, cursorEnd);
        updateTableContext(ta);
      });
    },
    [setValue]
  );

  function updateTableContext(ta: HTMLTextAreaElement) {
    setTableContext(!!findTableAtCursor(ta.value, ta.selectionStart));
  }

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!isSupportedImportFile(file)) {
        showToast('Only .md and .txt files are supported.', 'error');
        return;
      }
      try {
        const result = await buildImportPreview(file);
        setValue(result.singleContent);
        if (result.detectedSections.length >= 2) {
          showToast(
            `Imported "${file.name}" as one section. Use "Add section" to split it into ${result.detectedSections.length} sections instead.`,
            'info'
          );
        } else {
          showToast(`Imported "${file.name}"`, 'success');
        }
      } catch (err) {
        showToast(err instanceof FileImportError ? err.message : 'Could not read that file.', 'error');
      }
    },
    [setValue, showToast]
  );

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  }

  function openLinkDialog() {
    const ta = textareaRef.current;
    const selected = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : '';
    setLinkInitialText(selected);
    setLinkDialogOpen(true);
  }

  function handleLinkConfirm(text: string, url: string) {
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const markdown = `[${text}](${url})`;
      const newValue = v.slice(0, selectionStart) + markdown + v.slice(selectionEnd);
      const cursorPos = selectionStart + markdown.length;
      return { newValue, cursorStart: cursorPos, cursorEnd: cursorPos };
    });
  }

  function handleTableConfirm(markdown: string) {
    applyTransform((ta) => insertBlockAtCursor(ta, markdown));
  }

  function handleImageConfirm(alt: string, url: string) {
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const markdown = `![${alt}](${url})`;
      const newValue = v.slice(0, selectionStart) + markdown + v.slice(selectionEnd);
      const cursorPos = selectionStart + markdown.length;
      return { newValue, cursorStart: cursorPos, cursorEnd: cursorPos };
    });
  }

  function handleCodeConfirm(language: string) {
    applyTransform((ta) => insertBlockAtCursor(ta, `\`\`\`${language}\n\n\`\`\``));
  }

  function handleBoxConfirm(color: BoxColor, boxTitle: string) {
    const titlePart = boxTitle ? ` "${boxTitle}"` : '';
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const selected = v.slice(selectionStart, selectionEnd) || 'Type your content here.';
      const block = `:::box ${color}${titlePart}\n${selected}\n:::`;
      return insertBlockAtCursor(ta, block);
    });
  }

  function insertColumns() {
    // Wraps the current selection (e.g. a few selected lines) as the left
    // column of a two-column block, leaving the right column as a
    // placeholder to fill in. Works on any amount of selected text, down to
    // a single line.
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const selected = v.slice(selectionStart, selectionEnd);
      const left = selected || 'Left column';
      const right = 'Right column';
      const block = `:::columns\n${left}\n---\n${right}\n:::`;
      return insertBlockAtCursor(ta, block);
    });
  }

  async function handleRestoreRevision(content: string) {
    reset(content);
    const { error } = await onSave(content);
    if (error) showToast(`Could not restore version: ${error}`, 'error');
    else showToast('Restored previous version', 'success');
  }

  function handleTableOp(op: (val: string, pos: number) => { newValue: string; cursorPos: number } | null) {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = op(ta.value, ta.selectionStart);
    if (!result) return;
    setValue(result.newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(result.cursorPos, result.cursorPos);
      updateTableContext(ta);
    });
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    updateTableContext(e.target);
  };

  const handleClickOrKeyUp = (e: ReactMouseEvent<HTMLTextAreaElement> | KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget as HTMLTextAreaElement;
    updateTableContext(ta);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;

    // List / quote auto-continue on Enter.
    if (e.key === 'Enter' && !mod && !e.shiftKey) {
      const ta = e.currentTarget;
      const { selectionStart, selectionEnd, value: v } = ta;
      const lineStart = v.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineUpToCursor = v.slice(lineStart, selectionStart);

      // Symbol trigger: a line containing only ":::" expands into a full
      // box block, with the placeholder content pre-selected so typing
      // immediately replaces it. This is the "type a symbol" way to create
      // a box, as an alternative to the toolbar button/dialog.
      if (lineUpToCursor.trim() === ':::' && selectionStart === selectionEnd) {
        let lineEnd = v.indexOf('\n', selectionStart);
        if (lineEnd === -1) lineEnd = v.length;
        const restOfLine = v.slice(selectionStart, lineEnd);
        if (restOfLine.trim() === '') {
          e.preventDefault();
          const placeholder = 'Type your content here.';
          const openFence = ':::box violet\n';
          applyTransform((taInner) => {
            const { value: vv } = taInner;
            const before = vv.slice(0, lineStart);
            const after = vv.slice(lineEnd);
            const block = `${openFence}${placeholder}\n:::`;
            const newValue = before + block + after;
            const contentStart = before.length + openFence.length;
            const contentEnd = contentStart + placeholder.length;
            return { newValue, cursorStart: contentStart, cursorEnd: contentEnd };
          });
          return;
        }
      }

      const bulletMatch = lineUpToCursor.match(/^(\s*)([-*])\s+/);
      const numberedMatch = lineUpToCursor.match(/^(\s*)(\d+)\.\s+/);
      const quoteMatch = lineUpToCursor.match(/^(\s*)>\s?/);
      const match = bulletMatch || numberedMatch || quoteMatch;

      if (match) {
        e.preventDefault();
        const isEmptyItem = lineUpToCursor.trim() === match[0].trim() && selectionStart === selectionEnd;

        if (isEmptyItem) {
          // Exit the list: strip the marker and just start a plain new line.
          applyTransform((taInner) => {
            const { value: vv } = taInner;
            const newValue = vv.slice(0, lineStart) + vv.slice(selectionStart);
            return { newValue, cursorStart: lineStart, cursorEnd: lineStart };
          });
          return;
        }

        let continuation = '';
        if (bulletMatch) continuation = `${bulletMatch[1]}${bulletMatch[2]} `;
        else if (numberedMatch) continuation = `${numberedMatch[1]}${Number(numberedMatch[2]) + 1}. `;
        else if (quoteMatch) continuation = `${quoteMatch[1]}> `;

        applyTransform((taInner) => {
          const { value: vv, selectionStart: s, selectionEnd: en } = taInner;
          const newValue = vv.slice(0, s) + '\n' + continuation + vv.slice(en);
          const pos = s + 1 + continuation.length;
          return { newValue, cursorStart: pos, cursorEnd: pos };
        });
        return;
      }
    }

    if (e.key === 'Tab' && !mod) {
      e.preventDefault();
      applyTransform((ta) => {
        const { selectionStart, selectionEnd, value: v } = ta;
        const newValue = v.slice(0, selectionStart) + '  ' + v.slice(selectionEnd);
        const pos = selectionStart + 2;
        return { newValue, cursorStart: pos, cursorEnd: pos };
      });
      return;
    }

    if (!mod) return;

    if (e.key === 'b') {
      e.preventDefault();
      applyTransform((ta) => wrapSelection(ta, '**'));
    } else if (e.key === 'i') {
      e.preventDefault();
      applyTransform((ta) => wrapSelection(ta, '*'));
    } else if (e.key === 'u') {
      e.preventDefault();
      applyTransform((ta) => wrapSelection(ta, '__'));
    } else if (e.key.toLowerCase() === 'h' && e.shiftKey) {
      e.preventDefault();
      applyTransform((ta) => wrapSelection(ta, '=='));
    } else if (e.key === 'k') {
      e.preventDefault();
      openLinkDialog();
    } else if (e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
    } else if (e.key === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 's') {
      e.preventDefault();
      saveNow();
    }
  };

  const statusInfo = saveStatusLabel(status);
  const StatusIcon = statusInfo.icon;

  const headingButtons = [
    { icon: Heading1, label: 'Heading 1', action: () => applyTransform((ta) => prefixLines(ta, '# ')) },
    { icon: Heading2, label: 'Heading 2', action: () => applyTransform((ta) => prefixLines(ta, '## ')) },
    { icon: Heading3, label: 'Heading 3', action: () => applyTransform((ta) => prefixLines(ta, '### ')) },
  ];

  const formatButtons = [
    { icon: Bold, label: 'Bold (Ctrl+B)', action: () => applyTransform((ta) => wrapSelection(ta, '**')) },
    { icon: Italic, label: 'Italic (Ctrl+I)', action: () => applyTransform((ta) => wrapSelection(ta, '*')) },
    { icon: Underline, label: 'Underline (Ctrl+U)', action: () => applyTransform((ta) => wrapSelection(ta, '__')) },
    { icon: Strikethrough, label: 'Strikethrough', action: () => applyTransform((ta) => wrapSelection(ta, '~~')) },
    { icon: Highlighter, label: 'Highlight (Ctrl+Shift+H)', action: () => applyTransform((ta) => wrapSelection(ta, '==')) },
    { icon: Code, label: 'Inline code', action: () => applyTransform((ta) => wrapSelection(ta, '`')) },
  ];

  const blockButtons = [
    { icon: List, label: 'Bullet list', action: () => applyTransform((ta) => prefixLines(ta, '- ')) },
    { icon: ListOrdered, label: 'Numbered list', action: () => applyTransform((ta) => prefixLines(ta, '1. ')) },
    { icon: Quote, label: 'Block quote', action: () => applyTransform((ta) => prefixLines(ta, '> ')) },
    { icon: Minus, label: 'Horizontal rule', action: () => applyTransform((ta) => insertBlockAtCursor(ta, '---')) },
  ];

  const insertButtons = [
    { icon: Link2, label: 'Link (Ctrl+K)', action: openLinkDialog },
    { icon: ImagePlus, label: 'Image', action: () => setImageDialogOpen(true) },
    { icon: Table2, label: 'Table', action: () => setTableDialogOpen(true) },
    { icon: Code2, label: 'Code block', action: () => setCodeDialogOpen(true) },
    { icon: Square, label: 'Box', action: () => setBoxDialogOpen(true) },
    { icon: Columns, label: 'Columns', action: insertColumns },
  ];

  const tableToolButtons = [
    { icon: Rows3, label: 'Add row', action: () => handleTableOp(addTableRow) },
    { icon: RowsIcon, label: 'Remove row', action: () => handleTableOp(removeTableRow) },
    { icon: Columns3, label: 'Add column', action: () => handleTableOp(addTableColumn) },
    { icon: Columns2, label: 'Remove column', action: () => handleTableOp(removeTableColumn) },
  ];

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!readOnly && (
          <div className="flex flex-col border-b border-border">
            {/* Primary tool row: writing tools grouped by function, each group
                given breathing room rather than one undifferentiated strip. */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 pb-1 pt-2">
              <ToolGroup>
                {headingButtons.map(({ icon: Icon, label, action }) => (
                  <ToolButton key={label} icon={Icon} label={label} onClick={action} />
                ))}
              </ToolGroup>

              <ToolDivider />

              <ToolGroup>
                {formatButtons.map(({ icon: Icon, label, action }) => (
                  <ToolButton key={label} icon={Icon} label={label} onClick={action} />
                ))}
              </ToolGroup>

              <ToolDivider />

              <ToolGroup>
                {blockButtons.map(({ icon: Icon, label, action }) => (
                  <ToolButton key={label} icon={Icon} label={label} onClick={action} />
                ))}
              </ToolGroup>

              <ToolDivider />

              <ToolGroup>
                {insertButtons.map(({ icon: Icon, label, action }) => (
                  <ToolButton key={label} icon={Icon} label={label} onClick={action} />
                ))}
              </ToolGroup>

              {tableContext && (
                <>
                  <ToolDivider />
                  <div className="flex items-center gap-0.5 rounded-md bg-primary/[0.07] px-1 py-0.5">
                    <span className="mr-0.5 pl-1 font-mono text-[10px] uppercase tracking-wide text-primary/70">
                      Table
                    </span>
                    {tableToolButtons.map(({ icon: Icon, label, action }) => (
                      <ToolButton key={label} icon={Icon} label={label} onClick={action} accent />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Secondary row: file/history actions on the left, save status
                and the doc index signature + view switch on the right. */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 pb-1.5">
              <ToolGroup>
                <ToolButton
                  icon={Upload}
                  label="Import .md or .txt file (replaces current content)"
                  onClick={() => fileInputRef.current?.click()}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </ToolGroup>

              <ToolDivider />

              <ToolGroup>
                <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
                <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
                {sectionId && (
                  <ToolButton icon={History} label="Version history" onClick={() => setHistoryOpen(true)} />
                )}
              </ToolGroup>

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground/70 sm:inline">
                  {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
                </span>

                <div className="h-4 w-px bg-border" />

                <div className="doc-index" title={saveLabel ? `${statusInfo.text} · ${saveLabel}` : statusInfo.text}>
                  <StatusIcon
                    className={cn('mr-1 h-3 w-3', statusInfo.className, statusInfo.spin && 'animate-spin')}
                  />
                  <span className={statusInfo.className}>{statusInfo.text}</span>
                </div>
                {saveLabel && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {saveLabel}
                  </span>
                )}

                {sectionId && (
                  <ToolButton
                    icon={MessageSquare}
                    label="Comments"
                    onClick={() => setCommentsOpen((prev) => !prev)}
                    active={commentsOpen}
                  />
                )}

                <div className="flex items-center rounded-md border border-border bg-background/60 p-0.5">
                  <ViewModeButton
                    icon={Pencil}
                    label="Edit only"
                    active={viewMode === 'edit'}
                    onClick={() => setViewMode('edit')}
                  />
                  <ViewModeButton
                    icon={Columns2}
                    label="Split view"
                    active={viewMode === 'split'}
                    onClick={() => setViewMode('split')}
                  />
                  <ViewModeButton
                    icon={Eye}
                    label="Preview only"
                    active={viewMode === 'preview'}
                    onClick={() => setViewMode('preview')}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          ref={editorWrapRef}
          className={cn('relative grid flex-1 overflow-hidden', viewMode === 'split' && 'grid-cols-1 md:grid-cols-2')}
        >
          {viewMode !== 'preview' && (
            <div className="relative h-full min-w-0">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onClick={handleClickOrKeyUp}
                onKeyUp={handleClickOrKeyUp}
                readOnly={readOnly}
                placeholder="Start writing… Use the toolbar, or type ::: for a box. Supports **bold**, tables, [links](url), and more."
                className={cn(
                  'h-full w-full resize-none overflow-y-auto scrollbar-thin bg-transparent p-4 font-mono text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none',
                  viewMode === 'split' && 'border-r border-border'
                )}
                spellCheck={false}
              />
            </div>
          )}
          {viewMode !== 'edit' && (
            <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto scrollbar-thin bg-background/40 p-4">
              <TocPanel content={value} />
              <div
                className="doclix-prose"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(value) || '<p class="text-muted-foreground">Nothing to preview yet.</p>',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {sectionId && commentsOpen && (
        <CommentsPanel
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          sectionId={sectionId}
          project={project}
          section={section}
          role={role ?? (isOwner ? 'owner' : 'viewer')}
          mentionCandidates={mentionCandidates}
        />
      )}

      <LinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        initialText={linkInitialText}
        onConfirm={handleLinkConfirm}
      />
      <TableDialog open={tableDialogOpen} onOpenChange={setTableDialogOpen} onConfirm={handleTableConfirm} />
      <ImageDialog open={imageDialogOpen} onOpenChange={setImageDialogOpen} onConfirm={handleImageConfirm} />
      <CodeBlockDialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen} onConfirm={handleCodeConfirm} />
      <BoxDialog open={boxDialogOpen} onOpenChange={setBoxDialogOpen} onConfirm={handleBoxConfirm} />
      {sectionId && (
        <HistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          sectionId={sectionId}
          currentContent={value}
          onRestore={handleRestoreRevision}
        />
      )}
    </div>
  );
}
