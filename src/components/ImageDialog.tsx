import { useRef, useState, type ChangeEvent } from 'react';
import { Upload, Link2, Loader2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { uploadSectionImage, ImageUploadError } from '@/lib/imageUpload';
import { useAuth } from '@/contexts/AuthContext';

interface ImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (altText: string, url: string) => void;
}

type Mode = 'upload' | 'url';

export function ImageDialog({ open, onOpenChange, onConfirm }: ImageDialogProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('upload');
  const [alt, setAlt] = useState('');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetAll() {
    setMode('upload');
    setAlt('');
    setUrl('');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

  async function handleFile(file: File) {
    if (!user) {
      setError('You must be signed in to upload images.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const publicUrl = await uploadSectionImage(file, user.id);
      onConfirm(alt.trim() || file.name, publicUrl);
      resetAll();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ImageUploadError ? err.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleUrlConfirm() {
    if (!url.trim()) return;
    onConfirm(alt.trim() || 'Image', url.trim());
    resetAll();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>Upload a file or link to an image already online.</DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors duration-200',
              mode === 'upload' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors duration-200',
              mode === 'url' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Link2 className="h-3.5 w-3.5" />
            URL
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="image-alt">Alt text (optional)</Label>
            <Input
              id="image-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image"
            />
          </div>

          {mode === 'upload' ? (
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors duration-200',
                uploading ? 'pointer-events-none opacity-60' : 'border-border hover:border-primary/50'
              )}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {uploading ? 'Uploading…' : 'Click to choose an image (PNG, JPEG, GIF, WEBP, SVG — max 8MB)'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                type="url"
              />
            </div>
          )}

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>

        {mode === 'url' && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUrlConfirm} disabled={!url.trim()}>
              Insert image
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
