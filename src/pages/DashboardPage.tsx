import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, FileStack } from 'lucide-react';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ProjectIcon } from '@/components/ProjectIcon';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { Button } from '@/components/ui/Button';
import { useProjects } from '@/hooks/useProjects';
import { InlineSpinner, ErrorBanner, EmptyState } from '@/components/StateViews';
import { useToast } from '@/contexts/ToastContext';

export default function DashboardPage() {
  const { projects, loading, error, refetch, createProject, deleteProject } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleDelete(id: string) {
    const { error } = await deleteProject(id);
    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Project deleted', 'success');
    }
    setConfirmDeleteId(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ProjectHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="doc-index mb-2">dashboard</div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Your projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Documentation, wikis, and guides you own.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </div>

        {loading && <InlineSpinner label="Loading your projects…" />}
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        {!loading && !error && projects.length === 0 && (
          <EmptyState
            title="No documentation projects yet"
            description="Create your first project to start writing structured docs, wikis, or guides."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Create a project
              </Button>
            }
          />
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex flex-col rounded-lg border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/40"
              >
                <Link to={`/docs/${project.slug}`} className="flex flex-1 flex-col">
                  <ProjectIcon iconUrl={project.icon_url} size="md" className="mb-3" />
                  <h3 className="font-display font-medium">{project.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {project.description || 'No description'}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileStack className="h-3 w-3" />
                    <span>/docs/{project.slug}</span>
                  </div>
                </Link>

                {confirmDeleteId === project.id ? (
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-card p-1">
                    <button
                      className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(project.id)}
                    >
                      Confirm
                    </button>
                    <button
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(project.id)}
                    className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={createProject} />
    </div>
  );
}
