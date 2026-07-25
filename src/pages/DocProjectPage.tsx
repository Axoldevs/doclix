import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Eye, Plus } from 'lucide-react';
import { ProjectHeader } from '@/components/ProjectHeader';
import { Sidebar } from '@/components/Sidebar';
import { SectionFooterNav } from '@/components/SectionFooterNav';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { AddSectionDialog } from '@/components/AddSectionDialog';
import { ProjectSettingsDialog } from '@/components/ProjectSettingsDialog';
import { TranslateButton } from '@/components/TranslateButton';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner, ErrorBanner, EmptyState } from '@/components/StateViews';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useProject } from '@/hooks/useProject';
import { useSections } from '@/hooks/useSections';
import { getSupabase } from '@/lib/supabase';
import { renderMarkdown } from '@/lib/markdown';
import { slugify, cn } from '@/lib/utils';

export default function DocProjectPage() {
  const { projectSlug, sectionSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const { project, loading: projectLoading, error: projectError, notFound } = useProject(projectSlug);
  const {
    sections,
    loading: sectionsLoading,
    error: sectionsError,
    createSection,
    createSections,
    updateSection,
    deleteSection,
    reorderSections,
  } = useSections(project?.id);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);

  const isOwner = Boolean(user && project && user.id === project.owner_id);

  const activeSection = useMemo(() => {
    if (sections.length === 0) return null;
    if (sectionSlug) return sections.find((s) => s.slug === sectionSlug) ?? null;
    return sections[0];
  }, [sections, sectionSlug]);

  const activeIndex = activeSection ? sections.findIndex((s) => s.id === activeSection.id) : -1;
  const prevSection = activeIndex > 0 ? sections[activeIndex - 1] : null;
  const nextSection = activeIndex >= 0 && activeIndex < sections.length - 1 ? sections[activeIndex + 1] : null;

  // Reset any translated view whenever the user navigates to a different section
  useEffect(() => {
    setTranslatedContent(null);
  }, [activeSection?.id]);

  if (projectLoading) return <FullPageSpinner label="Loading project…" />;

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col">
        <ProjectHeader />
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4">
          <EmptyState
            title="Project not found"
            description="This documentation project doesn't exist or may have been deleted."
            action={<Button onClick={() => navigate('/')}>Back to projects</Button>}
          />
        </main>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex min-h-screen flex-col">
        <ProjectHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <ErrorBanner message={projectError ?? 'Something went wrong.'} />
        </main>
      </div>
    );
  }

  const currentProject = project;

  async function handleReorder(orderedIds: string[]) {
    const { error } = await reorderSections(orderedIds);
    if (error) showToast(error, 'error');
  }

  async function handleCreateSection(input: { title: string; slug: string; content?: string }) {
    const existing = sections.some((s) => s.slug === input.slug);
    const finalSlug = existing ? `${input.slug}-${Date.now().toString(36)}` : input.slug;
    const { error, section } = await createSection({
      title: input.title,
      slug: finalSlug,
      content: input.content,
    });
    if (!error && section) {
      navigate(`/docs/${currentProject.slug}/${section.slug}`);
      showToast('Section created', 'success');
    }
    return { error };
  }

  async function handleCreateMultipleSections(
    inputs: { title: string; slug: string; content: string }[]
  ) {
    const takenSlugs = new Set(sections.map((s) => s.slug));
    const finalInputs = inputs.map((input) => {
      let candidate = input.slug;
      let n = 2;
      while (takenSlugs.has(candidate)) {
        candidate = `${input.slug}-${n++}`;
      }
      takenSlugs.add(candidate);
      return { ...input, slug: candidate };
    });

    const { error, sections: created } = await createSections(finalInputs);
    if (!error && created && created.length > 0) {
      navigate(`/docs/${currentProject.slug}/${created[0].slug}`);
      showToast(`Imported ${created.length} section${created.length === 1 ? '' : 's'}`, 'success');
    }
    return { error };
  }

  async function handleRenameSection(id: string, title: string) {
    const newSlug = slugify(title);
    const { error } = await updateSection(id, { title, slug: newSlug });
    if (!error && activeSection?.id === id) {
      navigate(`/docs/${currentProject.slug}/${newSlug}`, { replace: true });
    }
    return { error };
  }

  async function handleDeleteSection(id: string) {
    const wasActive = activeSection?.id === id;
    const { error } = await deleteSection(id);
    if (!error && wasActive) {
      navigate(`/docs/${currentProject.slug}`, { replace: true });
    }
    return { error };
  }

  async function handleDeleteProject() {
    const { error } = await getSupabase().from('projects').delete().eq('id', currentProject.id);
    if (!error) {
      showToast('Project deleted', 'success');
      navigate('/');
    }
    return { error: error?.message ?? null };
  }

  async function handleSaveContent(content: string) {
    if (!activeSection) return { error: 'No section selected' };
    return updateSection(activeSection.id, { content });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ProjectHeader title={project.title} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          project={project}
          sections={sections}
          activeSlug={activeSection?.slug}
          isOwner={isOwner}
          onReorder={handleReorder}
          onAddSection={() => setAddDialogOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {sectionsError && (
            <div className="p-4">
              <ErrorBanner message={sectionsError} />
            </div>
          )}

          {sectionsLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <FullPageSpinner label="Loading sections…" />
            </div>
          ) : !activeSection ? (
            <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4">
              <EmptyState
                title="No sections yet"
                description={
                  isOwner
                    ? 'Add your first section to start building this documentation.'
                    : 'This project has no published sections yet.'
                }
                action={
                  isOwner ? (
                    <Button onClick={() => setAddDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Add section
                    </Button>
                  ) : undefined
                }
              />
            </main>
          ) : (
            <>
              <div
                className={cn(
                  'flex flex-1 flex-col px-4 py-6 sm:px-8',
                  editing ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin'
                )}
              >
                <div
                  className={cn(
                    'mx-auto flex w-full max-w-3xl flex-1 flex-col',
                    editing && 'overflow-hidden'
                  )}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight">{activeSection.title}</h1>
                    <div className="flex shrink-0 items-center gap-2">
                      {!editing && (
                        <TranslateButton
                          sourceText={activeSection.content}
                          onTranslated={setTranslatedContent}
                        />
                      )}
                      {isOwner && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing((prev) => !prev)}
                        >
                          {editing ? (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </>
                          ) : (
                            <>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {editing && isOwner ? (
                    <div className="flex-1 overflow-hidden">
                      <MarkdownEditor
                        key={activeSection.id}
                        initialContent={activeSection.content}
                        onSave={handleSaveContent}
                      />
                    </div>
                  ) : (
                    <div
                      className="doclix-prose flex-1"
                      dangerouslySetInnerHTML={{
                        __html:
                          renderMarkdown(translatedContent ?? activeSection.content) ||
                          '<p class="text-muted-foreground">This section has no content yet.</p>',
                      }}
                    />
                  )}
                </div>
              </div>

              {!editing && (
                <SectionFooterNav
                  projectSlug={project.slug}
                  prev={prevSection}
                  next={nextSection}
                />
              )}
            </>
          )}
        </div>
      </div>

      <AddSectionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreate={handleCreateSection}
        onCreateMultiple={handleCreateMultipleSections}
      />

      <ProjectSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        project={project}
        sections={sections}
        onRenameSection={handleRenameSection}
        onDeleteSection={handleDeleteSection}
        onDeleteProject={handleDeleteProject}
      />
    </div>
  );
}
