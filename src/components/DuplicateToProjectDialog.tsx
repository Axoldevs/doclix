import { useEffect, useState } from 'react';
import { Loader2, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Project, Section } from '@/types/database';

interface DuplicateToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: Section | null;
  currentProjectId: string;
  onDuplicated: (targetProject: Project) => void;
}

export function DuplicateToProjectDialog({
  open,
  onOpenChange,
  section,
  currentProjectId,
  onDuplicated,
}: DuplicateToProjectDialogProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setError(null);
    getSupabase()
      .from('projects')
      .select('*')
      .eq('owner_id', user.id)
      .neq('id', currentProjectId)
      .order('title', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setProjects(data ?? []);
        setLoading(false);
      });
  }, [open, user, currentProjectId]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTargetId(null);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!section || !targetId) return;
    const target = projects.find((p) => p.id === targetId);
    if (!target) return;

    setSubmitting(true);
    setError(null);

    const supabase = getSupabase();
    const { data: existingSections } = await supabase
      .from('sections')
      .select('slug, position')
      .eq('project_id', targetId);

    const takenSlugs = new Set((existingSections ?? []).map((s) => s.slug));
    let candidateSlug = section.slug;
    let n = 2;
    while (takenSlugs.has(candidateSlug)) {
      candidateSlug = `${section.slug}-${n++}`;
    }
    const nextPosition = existingSections?.length
      ? Math.max(...existingSections.map((s) => s.position)) + 1
      : 0;

    const { error: insertError } = await supabase.from('sections').insert({
      project_id: targetId,
      title: section.title,
      slug: candidateSlug,
      content: section.content,
      position: nextPosition,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onDuplicated(target);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate to another project</DialogTitle>
          <DialogDescription>
            {section ? `Copy "${section.title}" into one of your other projects.` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You don't have any other projects yet.
          </p>
        ) : (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto scrollbar-thin">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setTargetId(project.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150',
                  targetId === project.id
                    ? 'border-primary bg-primary/5 font-medium text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {project.title}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!targetId} loading={submitting}>
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
