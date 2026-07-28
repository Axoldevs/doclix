import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, Save } from 'lucide-react';
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
import { Textarea } from '@/components/ui/Textarea';
import type { Project, Section } from '@/types/database';

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  sections: Section[];
  onRenameSection: (id: string, title: string) => Promise<{ error: string | null }>;
  onDeleteSection: (id: string) => Promise<{ error: string | null }>;
  onDeleteProject: () => Promise<{ error: string | null }>;
  onUpdateProject: (updates: { title?: string; description?: string | null }) => Promise<{ error: string | null }>;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
  sections,
  onRenameSection,
  onDeleteSection,
  onDeleteProject,
  onUpdateProject,
}: ProjectSettingsDialogProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectTitle, setProjectTitle] = useState(project.title);
  const [projectDescription, setProjectDescription] = useState(project.description ?? '');
  const [savingProject, setSavingProject] = useState(false);
  const [projectSaved, setProjectSaved] = useState(false);

  const projectDirty = projectTitle !== project.title || projectDescription !== (project.description ?? '');

  useEffect(() => {
    if (open) {
      setProjectTitle(project.title);
      setProjectDescription(project.description ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  async function handleSaveProject() {
    if (!projectTitle.trim()) return;
    setSavingProject(true);
    setError(null);
    const { error } = await onUpdateProject({
      title: projectTitle.trim(),
      description: projectDescription.trim() || null,
    });
    setSavingProject(false);
    if (error) {
      setError(error);
    } else {
      setProjectSaved(true);
      setTimeout(() => setProjectSaved(false), 2000);
    }
  }

  function startEdit(section: Section) {
    setEditingId(section.id);
    setEditTitle(section.title);
  }

  async function saveRename(id: string) {
    if (!editTitle.trim()) return;
    setBusy(true);
    const { error } = await onRenameSection(id, editTitle.trim());
    setBusy(false);
    if (error) setError(error);
    else setEditingId(null);
  }

  async function handleDeleteSection(id: string) {
    setBusy(true);
    const { error } = await onDeleteSection(id);
    setBusy(false);
    if (error) setError(error);
    setConfirmDeleteId(null);
  }

  async function handleDeleteProject() {
    setBusy(true);
    const { error } = await onDeleteProject();
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Manage sections and project-level actions.</DialogDescription>
        </DialogHeader>

        {error && (
          <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-title">Project name</Label>
            <Input
              id="project-title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="What is this documentation about?"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveProject}
              disabled={!projectDirty || !projectTitle.trim()}
              loading={savingProject}
            >
              <Save className="h-3.5 w-3.5" />
              Save details
            </Button>
            {projectSaved && <span className="text-xs text-green-500">Saved</span>}
          </div>
        </div>

        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sections
        </div>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto scrollbar-thin">
          {sections.map((section) => (
            <div
              key={section.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              {editingId === section.id ? (
                <>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <Button size="sm" disabled={busy} onClick={() => saveRename(section.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 truncate text-left text-sm hover:text-primary"
                    onClick={() => startEdit(section)}
                  >
                    {section.title}
                  </button>
                  {confirmDeleteId === section.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Delete?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        Yes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        No
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirmDeleteId(section.id)}
                      title="Delete section"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {sections.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No sections yet.</p>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting this project removes all its sections permanently.
          </p>
          {confirmDeleteProject ? (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="destructive" loading={busy} onClick={handleDeleteProject}>
                Yes, delete everything
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteProject(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              className="mt-3"
              onClick={() => setConfirmDeleteProject(true)}
            >
              Delete project
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
