import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo2,
  Redo2,
  Eye,
  Columns2,
  Pencil,
  Check,
  Loader2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown';
import { useHistory } from '@/hooks/useHistory';
import { useAutoSave, type SaveStatus } from '@/hooks/useAutoSave';
import { buildImportPreview, isSupportedImportFile, FileImportError } from '@/lib/fileImport';
import { useToast } from '@/contexts/ToastContext';

type ViewMode = 'edit' | 'split' | 'preview';

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<{ error: string | null }>;
  readOnly?: boolean;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string = before
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const newValue =
    value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  return { newValue, cursorStart: selectionStart + before.length, cursorEnd: selectionEnd + before.length };
}

function prefixLines(textarea: HTMLTextAreaElement, prefix: string) {
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

export function MarkdownEditor({ initialContent, onSave, readOnly }: MarkdownEditorProps) {
  const { value, setValue, undo, redo, reset, canUndo, canRedo } = useHistory(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>(readOnly ? 'preview' : 'split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { status, saveNow } = useAutoSave(value, onSave);

  useEffect(() => {
    reset(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  const applyTransform = useCallback(
    (transform: (ta: HTMLTextAreaElement) => { newValue: string; cursorStart: number; cursorEnd: number }) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const { newValue, cursorStart, cursorEnd } = transform(ta);
      setValue(newValue);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(cursorStart, cursorEnd);
      });
    },
    [setValue]
  );

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
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

  const toolbarButtons = [
    { icon: Bold, label: 'Bold (Ctrl+B)', action: () => applyTransform((ta) => wrapSelection(ta, '**')) },
    { icon: Italic, label: 'Italic (Ctrl+I)', action: () => applyTransform((ta) => wrapSelection(ta, '*')) },
    { icon: Underline, label: 'Underline (Ctrl+U)', action: () => applyTransform((ta) => wrapSelection(ta, '__')) },
    { icon: Strikethrough, label: 'Strikethrough', action: () => applyTransform((ta) => wrapSelection(ta, '~~')) },
    { icon: Code, label: 'Inline code', action: () => applyTransform((ta) => wrapSelection(ta, '`')) },
    { icon: Heading1, label: 'Heading 1', action: () => applyTransform((ta) => prefixLines(ta, '# ')) },
    { icon: Heading2, label: 'Heading 2', action: () => applyTransform((ta) => prefixLines(ta, '## ')) },
    { icon: List, label: 'Bullet list', action: () => applyTransform((ta) => prefixLines(ta, '- ')) },
    { icon: ListOrdered, label: 'Numbered list', action: () => applyTransform((ta) => prefixLines(ta, '1. ')) },
    { icon: Quote, label: 'Block quote', action: () => applyTransform((ta) => prefixLines(ta, '> ')) },
    { icon: Link2, label: 'Link', action: () => applyTransform((ta) => wrapSelection(ta, '[', '](url)')) },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
          {toolbarButtons.map(({ icon: Icon, label, action }) => (
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

          <div className="ml-auto flex items-center gap-1">
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

      <div className={cn('grid flex-1 overflow-hidden', viewMode === 'split' && 'grid-cols-1 md:grid-cols-2')}>
        {viewMode !== 'preview' && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            placeholder="Start writing… Discord-style markdown supported: **bold**, *italic*, `code`, # headings, - lists"
            className={cn(
              'h-full w-full resize-none overflow-y-auto scrollbar-thin bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none',
              viewMode === 'split' && 'border-r border-border'
            )}
            spellCheck={false}
          />
        )}
        {viewMode !== 'edit' && (
          <div
            className="doclix-prose h-full overflow-y-auto scrollbar-thin p-4"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || '<p class="text-muted-foreground">Nothing to preview yet.</p>' }}
          />
        )}
      </div>
    </div>
  );
}
