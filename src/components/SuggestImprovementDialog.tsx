import { useState, type FormEvent } from 'react';
import { Lightbulb, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { useSectionSuggestions, notifySuggestion } from '@/hooks/useSectionSuggestions';
import type { Project, Section } from '@/types/database';

interface SuggestImprovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  section: Section;
}

/** "Suggest an improvement" for visitors who aren't signed-in team
 * members: lighter weight than the full comment system, doesn't require
 * an account, and lands in a separate review list for the team rather
 * than mixing into section_comments threads. */
export function SuggestImprovementDialog({ open, onOpenChange, project, section }: SuggestImprovementDialogProps) {
  const { submitSuggestion } = useSectionSuggestions(project.id, false);
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error } = await submitSuggestion({
      sectionId: section.id,
      projectId: project.id,
      body: body.trim(),
      name: name.trim(),
      email: email.trim(),
    });
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    // Best-effort notification to the team; failure here shouldn't block
    // the visitor from seeing their suggestion was received.
    notifySuggestion(project, section.title).catch(() => {});
    setDone(true);
    setBody('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) setDone(false);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Suggest an improvement
          </DialogTitle>
          <DialogDescription>
            Spotted something wrong or unclear in "{section.title}"? Let the team know.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Check className="h-6 w-6 text-primary" />
            Thanks — your suggestion was sent to the team.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="suggestion-body" className="text-xs">
                Your suggestion
              </Label>
              <Textarea
                id="suggestion-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="e.g. The installation command doesn't work anymore."
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="suggestion-name" className="text-xs">
                  Name (optional)
                </Label>
                <Input id="suggestion-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="suggestion-email" className="text-xs">
                  Email (optional)
                </Label>
                <Input
                  id="suggestion-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" loading={submitting} disabled={!body.trim()} className="mt-1">
              Send suggestion
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
