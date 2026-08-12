import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
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
  Layers,
  ChevronDown,
  PanelsTopLeft,
  Info,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderMarkdown, type BoxColor, type CalloutKind } from '@/lib/markdown';
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
import { hydrateDoclixContent } from '@/lib/hydrateDoclixContent';

type ViewMode = 'edit' | 'split' | 'preview';

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<{ error: string | null }>;
  readOnly?: boolean;
  sectionId?: string;
  isOwner?: boolean;
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

export function MarkdownEditor({ initialContent, onSave, readOnly, sectionId, isOwner }: MarkdownEditorProps) {
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
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    return hydrateDoclixContent(el);
  }, [value, viewMode]);

  // Only reset the editor's internal buffer when we're actually switching to
  // a *different* section (tracked by sectionId), or on first mount. Do NOT
  // reset merely because `initialContent` changed reference/value — that
  // happens on every autosave round-trip (the parent refetches the row from
  // Supabase and passes a fresh `activeSection.content` string down), and
  // resetting here would discard in-flight edits and snap the textarea's
  // value — and with it the caret — back to whatever was last saved. The
  // editor is the source of truth for its own buffer once mounted; the
  // "initialContent" prop only matters for the very first paint of a given
  // section.
  const lastLoadedSectionRef = useRef<string | undefined>(sectionId);
  useEffect(() => {
    if (lastLoadedSectionRef.current === sectionId) return;
    lastLoadedSectionRef.current = sectionId;
    reset(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

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

  function insertSection(kind: 'Section' | 'SubSection' | 'SubSubSection') {
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const selected = v.slice(selectionStart, selectionEnd) || 'Title';
      const block = `<-${kind}-${selected}->`;
      const transform = insertBlockAtCursor(ta, block);
      // Select just the title text so typing immediately replaces it.
      const prefixLen = `<-${kind}-`.length;
      const titleStart = transform.newValue.indexOf(block) + prefixLen;
      return { ...transform, cursorStart: titleStart, cursorEnd: titleStart + selected.length };
    });
  }

  function insertCallout(kind: CalloutKind) {
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const selected = v.slice(selectionStart, selectionEnd) || 'Type your content here.';
      const block = `:::${kind}\n${selected}\n:::`;
      return insertBlockAtCursor(ta, block);
    });
  }

  function insertCollapse() {
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const selected = v.slice(selectionStart, selectionEnd) || 'Hidden content goes here.';
      const block = `:::collapse "Click to expand"\n${selected}\n:::`;
      return insertBlockAtCursor(ta, block);
    });
  }

  function insertTabs() {
    applyTransform((ta) => {
      const block =
        ':::tabs\n<-Tab-JavaScript->\nconsole.log("Hello");\n<-Tab-Python->\nprint("Hello")\n:::';
      return insertBlockAtCursor(ta, block);
    });
  }

  function insertInternalLink() {
    applyTransform((ta) => {
      const { selectionStart, selectionEnd, value: v } = ta;
      const selected = v.slice(selectionStart, selectionEnd);
      const markdown = selected ? `[[${selected}]]` : '[[Page Name]]';
      const newValue = v.slice(0, selectionStart) + markdown + v.slice(selectionEnd);
      const cursorPos = selectionStart + markdown.length;
      return { newValue, cursorStart: cursorPos, cursorEnd: cursorPos };
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
    { icon: LinkIcon, label: 'Internal link [[Page]]', action: insertInternalLink },
    { icon: ImagePlus, label: 'Image', action: () => setImageDialogOpen(true) },
    { icon: Table2, label: 'Table', action: () => setTableDialogOpen(true) },
    { icon: Code2, label: 'Code block', action: () => setCodeDialogOpen(true) },
    { icon: Square, label: 'Box', action: () => setBoxDialogOpen(true) },
    { icon: Columns, label: 'Columns', action: insertColumns },
  ];

  const sectionButtons = [
    { icon: Layers, label: 'Section', action: () => insertSection('Section') },
    { icon: Layers, label: 'SubSection', action: () => insertSection('SubSection') },
    { icon: Layers, label: 'SubSubSection', action: () => insertSection('SubSubSection') },
  ];

  const doclixButtons = [
    { icon: Info, label: 'Info container', action: () => insertCallout('info') },
    { icon: AlertCircle, label: 'Warning container', action: () => insertCallout('warning') },
    { icon: ChevronDown, label: 'Collapsible section', action: insertCollapse },
    { icon: PanelsTopLeft, label: 'Tabs', action: insertTabs },
  ];

  const tableToolButtons = [
    { icon: Rows3, label: 'Add row', action: () => handleTableOp(addTableRow) },
    { icon: RowsIcon, label: 'Remove row', action: () => handleTableOp(removeTableRow) },
    { icon: Columns3, label: 'Add column', action: () => handleTableOp(addTableColumn) },
    { icon: Columns2, label: 'Remove column', action: () => handleTableOp(removeTableColumn) },
  ];

  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
            {headingButtons.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={action}
                className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            <div className="mx-1 h-5 w-px bg-border" />

            {formatButtons.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={action}
                className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            <div className="mx-1 h-5 w-px bg-border" />

            {blockButtons.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={action}
                className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            <div className="mx-1 h-5 w-px bg-border" />

            {insertButtons.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={action}
                className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            <div className="mx-1 h-5 w-px bg-border" />

            {sectionButtons.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={action}
                className="rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <Icon className="mr-0.5 inline h-3.5 w-3.5" />
                {label}
              </button>
            ))}

            <div className="mx-1 h-5 w-px bg-border" />

            {doclixButtons.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                title={label}
                onClick={action}
                className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            {tableContext && (
              <>
                <div className="mx-1 h-5 w-px bg-border" />
                {tableToolButtons.map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    onClick={action}
                    className="rounded-md p-1.5 text-primary transition-colors duration-200 hover:bg-primary/10"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </>
            )}

            <div className="mx-1 h-5 w-px bg-border" />

            <button
              type="button"
              title="Import .md or .txt file (replaces current content)"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <div className="mx-1 h-5 w-px bg-border" />

            <button
              type="button"
              title="Undo (Ctrl+Z)"
              disabled={!canUndo}
              onClick={undo}
              className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground disabled:opacity-30"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Redo (Ctrl+Shift+Z)"
              disabled={!canRedo}
              onClick={redo}
              className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground disabled:opacity-30"
            >
              <Redo2 className="h-4 w-4" />
            </button>

            {sectionId && (
              <button
                type="button"
                title="Version history"
                onClick={() => setHistoryOpen(true)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <History className="h-4 w-4" />
              </button>
            )}

            <div className="ml-auto flex items-center gap-1">
              {sectionId && (
                <button
                  type="button"
                  title="Comments"
                  onClick={() => setCommentsOpen((prev) => !prev)}
                  className={cn(
                    'mr-1 rounded-md p-1.5 transition-colors duration-200',
                    commentsOpen ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              )}

              <div className="mr-2 flex items-center gap-1.5 text-xs">
                <StatusIcon className={cn('h-3.5 w-3.5', statusInfo.className, statusInfo.spin && 'animate-spin')} />
                <span className={statusInfo.className}>{statusInfo.text}</span>
              </div>

              <div className="flex items-center rounded-md border border-border p-0.5">
                <button
                  type="button"
                  title="Edit only"
                  onClick={() => setViewMode('edit')}
                  className={cn(
                    'rounded p-1.5 transition-colors duration-200',
                    viewMode === 'edit' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Split view"
                  onClick={() => setViewMode('split')}
                  className={cn(
                    'rounded p-1.5 transition-colors duration-200',
                    viewMode === 'split' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Preview only"
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    'rounded p-1.5 transition-colors duration-200',
                    viewMode === 'preview' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={editorWrapRef} className={cn('relative grid flex-1 overflow-hidden', viewMode === 'split' && 'grid-cols-1 md:grid-cols-2')}>
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
                  'h-full w-full resize-none overflow-y-auto scrollbar-thin bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none',
                  viewMode === 'split' && 'border-r border-border'
                )}
                spellCheck={false}
              />
            </div>
          )}
          {viewMode !== 'edit' && (
            <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto scrollbar-thin p-4">
              <TocPanel content={value} />
              <div
                ref={previewRef}
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
          isOwner={!!isOwner}
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
