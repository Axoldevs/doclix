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
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

interface CodeBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (language: string) => void;
}

const LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'json',
  'bash',
  'sql',
  'yaml',
  'html',
  'css',
  'jsx',
  'diff',
  'plaintext',
];

export function CodeBlockDialog({ open, onOpenChange, onConfirm }: CodeBlockDialogProps) {
  const [language, setLanguage] = useState('javascript');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm(language === 'plaintext' ? '' : language);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert code block</DialogTitle>
          <DialogDescription>Choose a language for syntax highlighting.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Language</Label>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs transition-colors duration-200',
                    language === lang
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
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
