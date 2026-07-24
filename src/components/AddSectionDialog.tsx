import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Upload, FileText, X, Layers, File as FileIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn, slugify } from '@/lib/utils';
import {
  buildImportPreview,
  isSupportedImportFile,
  FileImportError,
  type ImportPreview,
} from '@/lib/fileImport';

interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { title: string; slug: string; content?: string }) => Promise<{
    error: string | null;
  }>;
  onCreateMultiple: (
    inputs: { title: string; slug: string; content: string }[]
  ) => Promise<{ error: string | null }>;
}

type Mode = 'manual' | 'upload';
type SplitChoice = 'single' | 'split';

export function AddSectionDialog({
  open,
  onOpenChange,
  onCreate,
  onCreateMultiple,
}: AddSectionDialogProps) {
  const [mode, setMode] = useState<Mode>('manual');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [splitChoice, setSplitChoice] = useState<SplitChoice>('split');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetAll() {
    setMode('manual');
    setTitle('');
    setPreview(null);
    setFileName(null);
    setSplitChoice('split');
    setError(null);
  }

  async function handleFile(file: File) {
    setError(null);
    if (!isSupportedImportFile(file)) {
      setError('Only .md and .txt files are supported.');
      return;
    }
    try {
      const result = await buildImportPreview(file);
      setPreview(result);
      setTitle(result.fileTitle);
      setFileName(file.name);
      setSplitChoice(result.detectedSections.length >= 2 ? 'split' : 'single');
    } catch (err) {
      setError(err instanceof FileImportError ? err.message : 'Could not read that file.');
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function clearFile() {
    setPreview(null);
    setFileName(null);
  }

  const willSplit = mode === 'upload' && preview && preview.detectedSections.length >= 2 && splitChoice === 'split';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (mode === 'manual') {
      if (!title.trim()) return;
      setLoading(true);
      setError(null);
      const { error } = await onCreate({ title: title.trim(), slug: slugify(title) });
      setLoading(false);
      if (error) setError(error);
      else {
        resetAll();
        onOpenChange(false);
      }
      return;
    }

    // upload mode
    if (!preview) return;

    setLoading(true);
    setError(null);

    if (willSplit) {
      const inputs = preview.detectedSections.map((s) => ({
        title: s.title,
        slug: slugify(s.title),
        content: s.content,
      }));
      const { error } = await onCreateMultiple(inputs);
      setLoading(false);
      if (error) setError(error);
      else {
        resetAll();
        onOpenChange(false);
      }
    } else {
      if (!title.trim()) {
        setLoading(false);
        return;
      }
      const { error } = await onCreate({
        title: title.trim(),
        slug: slugify(title),
        content: preview.singleContent,
      });
      setLoading(false);
      if (error) setError(error);
      else {
        resetAll();
        onOpenChange(false);
      }
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

  const canSubmit =
    mode === 'manual'
      ? title.trim().length > 0
      : Boolean(preview) && (willSplit || title.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(willSplit && 'max-w-lg')}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a section</DialogTitle>
            <DialogDescription>
              Create a page manually, or import one or more from a .md or .txt file.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4 flex rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm transition-colors duration-200',
                mode === 'manual'
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Write manually
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm transition-colors duration-200',
                mode === 'upload'
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Upload file
            </button>
          </div>

          {mode === 'manual' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="section-title">Title</Label>
              <Input
                id="section-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Getting Started"
              />
              {title && <p className="text-xs text-muted-foreground">URL: /{slugify(title)}</p>}
            </div>
          ) : !preview ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors duration-200',
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop a <span className="font-medium text-foreground">.md</span> or{' '}
                <span className="font-medium text-foreground">.txt</span> file here, or click to
                browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm">{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {preview.detectedSections.length >= 2 && (
                <div className="rounded-lg border border-border p-1">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => setSplitChoice('split')}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors duration-200',
                        splitChoice === 'split'
                          ? 'bg-secondary font-medium text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Split into {preview.detectedSections.length} sections
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitChoice('single')}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors duration-200',
                        splitChoice === 'single'
                          ? 'bg-secondary font-medium text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <FileIcon className="h-3.5 w-3.5" />
                      Keep as one section
                    </button>
                  </div>
                </div>
              )}

              {preview.detectedSections.length >= 2 && splitChoice === 'split' ? (
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Detected top-level headings (a single <code className="rounded bg-secondary px-1">#</code> line)
                    will each become their own section, in order:
                  </p>
                  <div className="flex max-h-48 flex-col gap-1 overflow-y-auto scrollbar-thin rounded-lg border border-border p-2">
                    {preview.detectedSections.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                      >
                        <span className="text-xs text-muted-foreground">{i + 1}.</span>
                        <span className="truncate">{s.title}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          /{slugify(s.title)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="section-title-upload">Title</Label>
                  <Input
                    id="section-title-upload"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  {title && <p className="text-xs text-muted-foreground">URL: /{slugify(title)}</p>}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {preview.isMarkdown
                  ? 'Markdown content is imported as-is.'
                  : 'Plain text is imported as markdown with special characters escaped so it renders as-is.'}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!canSubmit}>
              {willSplit
                ? `Create ${preview?.detectedSections.length} sections`
                : 'Create section'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
