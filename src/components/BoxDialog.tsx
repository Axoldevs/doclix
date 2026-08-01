import { useState, type FormEvent } from 'react';
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
import { BOX_COLORS, type BoxColor } from '@/lib/markdown';

interface BoxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (color: BoxColor, title: string) => void;
}

const COLOR_SWATCH: Record<BoxColor, string> = {
  violet: '#8b5cf6',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#6b7280',
};

export function BoxDialog({ open, onOpenChange, onConfirm }: BoxDialogProps) {
  const [color, setColor] = useState<BoxColor>('violet');
  const [title, setTitle] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm(color, title.trim());
    setTitle('');
    setColor('violet');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert a box</DialogTitle>
          <DialogDescription>A bordered callout box for notes, tips, or warnings.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Border color</Label>
            <div className="flex flex-wrap gap-2">
              {BOX_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform duration-150',
                    color === c ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105'
                  )}
                >
                  <span
                    className="block h-5 w-5 rounded-full"
                    style={{ backgroundColor: COLOR_SWATCH[c] }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="box-title">Title (optional)</Label>
            <Input
              id="box-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Note, Warning, Heads up"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Insert</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
