import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Eye, Plus, MessageSquare, Lightbulb } from 'lucide-react';
import { ProjectHeader } from '@/components/ProjectHeader';
import { Sidebar } from '@/components/Sidebar';
import { SectionFooterNav } from '@/components/SectionFooterNav';
import { TocPanel } from '@/components/TocPanel';
import { TranslateButton } from '@/components/TranslateButton';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner, ErrorBanner, EmptyState } from '@/components/StateViews';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useProject } from '@/hooks/useProject';
import { useSections } from '@/hooks/useSections';
import { useProjectRole } from '@/hooks/useProjectRole';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useProjectTeamProfiles } from '@/hooks/useProjectTeamProfiles';
import { getSupabase } from '@/lib/supabase';
import { getPreferredLanguage, translateText } from '@/lib/translate';
import { renderMarkdown } from '@/lib/markdown';
import { slugify, cn, hexToHslTriple } from '@/lib/utils';
import {
  canComment,
  canDeleteDocs,
  canEditDocs,
  canManageMembers,
  canManageProjectSettings,
  canPublish,
  isTeamMember,
} from '@/lib/permissions';
import type { ProjectUpdate, Section, SectionPendingChange } from '@/types/database';

// These six are all team/editing-only surfaces -- a reader just viewing
// docs (the overwhelming majority of traffic, and everyone hitting the
// pre-rendered SSR-ish HTML from functions/docs/[[path]].ts) never
// triggers any of them, so their code shouldn't be in the initial bundle.
// Each is already conditionally mounted (editing state, dialog `open`
// props, panel toggles), so lazy() + a lightweight Suspense fallback is a
// drop-in swap with no behavior change for readers.
const MarkdownEditor = lazy(() =>
  import('@/components/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor }))
);
const CommentsPanel = lazy(() =>
  import('@/components/CommentsPanel').then((m) => ({ default: m.CommentsPanel }))
);
const AddSectionDialog = lazy(() =>
  import('@/components/AddSectionDialog').then((m) => ({ default: m.AddSectionDialog }))
);
const ProjectSettingsDialog = lazy(() =>
  import('@/components/ProjectSettingsDialog').then((m) => ({ default: m.ProjectSettingsDialog }))
);
const DuplicateToProjectDialog = lazy(() =>
  import('@/components/DuplicateToProjectDialog').then((m) => ({ default: m.DuplicateToProjectDialog }))
);
const ProjectAccessGate = lazy(() =>
  import('@/components/ProjectAccessGate').then((m) => ({ default: m.ProjectAccessGate }))
);
const TeamMembersDialog = lazy(() =>
  import('@/components/TeamMembersDialog').then((m) => ({ default: m.TeamMembersDialog }))
);
const ReviewQueueDialog = lazy(() =>
  import('@/components/ReviewQueueDialog').then((m) => ({ default: m.ReviewQueueDialog }))
);
const SuggestImprovementDialog = lazy(() =>
  import('@/components/SuggestImprovementDialog').then((m) => ({ default: m.SuggestImprovementDialog }))
);

function PanelLoading() {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

export default function DocProjectPage() {
  const { projectSlug, sectionSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const {
    project,
    loading: projectLoading,
    error: projectError,
    notFound,
    updateProject,
  } = useProject(projectSlug);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [insertAfterSection, setInsertAfterSection] = useState<Section | null>(null);
  const [duplicateToProjectSection, setDuplicateToProjectSection] = useState<Section | null>(null);
  const [readerCommentsOpen, setReaderCommentsOpen] = useState(false);

  const { role: resolvedRole } = useProjectRole(project);
  // Anonymous/no-role visitors are treated as 'viewer' for permission
  // checks throughout this page -- useProjectRole returns null only
  // while loading or when there's no session at all.
  const role = resolvedRole ?? 'viewer';
  const isTeam = Boolean(user) && isTeamMember(role);
  const canEdit = canEditDocs(role);
  const canDelete = canDeleteDocs(role);
  const canPublishDirectly = canPublish(role);
  const canManageTeam = canManageMembers(role);
  const canManageSettings = canManageProjectSettings(role);
  const canLeaveComment = canComment(role);

  const {
    sections,
    loading: sectionsLoading,
    error: sectionsError,
    gate,
    retryAfterUnlock,
    createSection,
    createSectionAt,
    createSections,
    duplicateSection,
    updateSection,
    deleteSection,
    reorderSections,
  } = useSections(project?.id, project?.slug, project?.visibility);

  const { members } = useProjectMembers(canManageTeam ? project?.id : undefined);
  const { mentionCandidates, profiles } = useProjectTeamProfiles(isTeam ? project : undefined, members);
  const submitterName = (userId: string) => profiles.find((p) => p.userId === userId)?.name ?? userId;

  const {
    changes: pendingChanges,
    pendingCount,
    submitEdit,
    submitNewSection,
    approve,
    reject,
  } = usePendingChanges(canEdit ? project : undefined);

  // isOwner kept as a narrower alias for the few surfaces that are
  // strictly owner-only (delete project, transfer ownership) --
  // everything else in this file now checks role-derived capability
  // flags instead.
  const isOwner = role === 'owner';

  // Readers who aren't team members never see hidden sections in the nav
  // or as the default landing section; team members still see
  // everything so editors/admins can manage hidden content.
  const visibleSections = useMemo(
    () => (isTeam ? sections : sections.filter((s) => !s.hidden)),
    [sections, isTeam]
  );

  const activeSection = useMemo(() => {
    if (visibleSections.length === 0) return null;
    if (sectionSlug) return visibleSections.find((s) => s.slug === sectionSlug) ?? null;
    return visibleSections[0];
  }, [visibleSections, sectionSlug]);

  const activeIndex = activeSection ? visibleSections.findIndex((s) => s.id === activeSection.id) : -1;
  const prevSection = activeIndex > 0 ? visibleSections[activeIndex - 1] : null;
  const nextSection =
    activeIndex >= 0 && activeIndex < visibleSections.length - 1 ? visibleSections[activeIndex + 1] : null;

  // Apply the project's accent color (if any) as a scoped CSS variable
  // override -- --primary and the two gradient stops all derive their hue
  // from the same source, so overriding all three keeps buttons, links,
  // and gradient surfaces consistent instead of just recoloring text.
  const accentStyle = useMemo(() => {
    if (!project?.accent_color) return undefined;
    const hsl = hexToHslTriple(project.accent_color);
    if (!hsl) return undefined;
    return {
      '--primary': hsl,
      '--gradient-start': hsl,
      '--gradient-end': hsl,
    } as React.CSSProperties;
  }, [project?.accent_color]);

  // Inject the project's custom <head> snippet (analytics scripts, extra
  // meta tags, etc.) only while this project's page is mounted, and clean
  // up on unmount/project change so navigating to a different project
  // doesn't leave a previous project's scripts running.
  useEffect(() => {
    if (!project?.custom_head_snippet) return;
    const container = document.createElement('div');
    container.innerHTML = project.custom_head_snippet;
    const nodes = Array.from(container.childNodes);
    nodes.forEach((node) => document.head.appendChild(node));
    return () => {
      nodes.forEach((node) => {
        if (node.parentNode === document.head) document.head.removeChild(node);
      });
    };
  }, [project?.custom_head_snippet]);


  // When the user navigates to a different section, keep them in their chosen
  // language rather than snapping back to the original. If they've picked a
  // non-English language before (saved in a cookie), translate the new
  // section's content into it automatically.
  useEffect(() => {
    if (!activeSection) {
      setTranslatedContent(null);
      return;
    }

    const preferred = getPreferredLanguage();
    if (preferred === 'en') {
      setTranslatedContent(null);
      return;
    }

    let cancelled = false;
    translateText(activeSection.content, preferred, 'en')
      .then((translated) => {
        if (!cancelled) setTranslatedContent(translated);
      })
      .catch(() => {
        // If translation fails (e.g. offline), fall back to the original
        // rather than leaving a stale translation from the previous section.
        if (!cancelled) setTranslatedContent(null);
      });

    return () => {
      cancelled = true;
    };
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
            action={<Button onClick={() => navigate('/dashboard')}>Back to projects</Button>}
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

    if (!canPublishDirectly) {
      // Editors can't insert into `sections` directly (RLS restricts
      // that to owner/admin) -- a new section goes through the same
      // review queue as an edit, appearing to the editor as "submitted"
      // rather than immediately live and navigable.
      const { error } = await submitNewSection(input.title, finalSlug, input.content ?? '');
      if (!error) showToast('New section submitted for review', 'success');
      setInsertAfterSection(null);
      return { error };
    }

    const result = insertAfterSection
      ? await createSectionAt(
          { title: input.title, slug: finalSlug, content: input.content },
          sections.findIndex((s) => s.id === insertAfterSection.id) + 1
        )
      : await createSection({ title: input.title, slug: finalSlug, content: input.content });

    const { error, section } = result;
    if (!error && section) {
      navigate(`/docs/${currentProject.slug}/${section.slug}`);
      showToast(insertAfterSection ? `Section inserted after "${insertAfterSection.title}"` : 'Section created', 'success');
      setInsertAfterSection(null);
    }
    return { error };
  }

  async function handleDuplicateSection(section: Section) {
    const { error, section: created } = await duplicateSection(section.id);
    if (!error && created) {
      navigate(`/docs/${currentProject.slug}/${created.slug}`);
      showToast(`Duplicated "${section.title}"`, 'success');
    } else if (error) {
      showToast(error, 'error');
    }
  }

  function handleRequestInsertAfter(section: Section) {
    setInsertAfterSection(section);
    setAddDialogOpen(true);
  }

  function handleRequestDelete(section: Section) {
    handleDeleteSection(section.id).then(({ error }) => {
      if (error) showToast(error, 'error');
      else showToast(`Deleted "${section.title}"`, 'success');
    });
  }

  function handleMoveUp(section: Section) {
    const idx = sections.findIndex((s) => s.id === section.id);
    if (idx <= 0) return;
    const reordered = [...sections];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    reorderSections(reordered.map((s) => s.id));
  }

  function handleMoveDown(section: Section) {
    const idx = sections.findIndex((s) => s.id === section.id);
    if (idx === -1 || idx >= sections.length - 1) return;
    const reordered = [...sections];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    reorderSections(reordered.map((s) => s.id));
  }

  async function handleUpdateProject(updates: ProjectUpdate) {
    const { error } = await updateProject(updates);
    if (!error) showToast('Project details updated', 'success');
    return { error };
  }

  async function handleToggleSectionHidden(id: string, hidden: boolean) {
    const { error } = await updateSection(id, { hidden });
    if (!error) showToast(hidden ? 'Section hidden from navigation' : 'Section shown in navigation', 'success');
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
      navigate('/dashboard');
    }
    return { error: error?.message ?? null };
  }

  async function handleSaveContent(content: string) {
    if (!activeSection) return { error: 'No section selected' };
    if (canPublishDirectly) {
      return updateSection(activeSection.id, { content });
    }
    // Editors can't write `sections` directly -- their save submits a
    // pending change for an owner/admin to review instead. The editor
    // (readOnly=false, autosave still running) reflects "saved" locally
    // via the pending-change insert succeeding, but the published
    // content doesn't change until it's approved.
    const { error } = await submitEdit(activeSection, activeSection.title, content);
    if (!error) showToast('Submitted for review', 'success');
    return { error };
  }

  async function handleApproveChange(change: SectionPendingChange) {
    const { error } = await approve(change, async (c) => {
      if (c.is_new_section) {
        const slug = c.proposed_slug || slugify(c.proposed_title);
        const existing = sections.some((s) => s.slug === slug);
        const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;
        const { error } = await createSection({
          title: c.proposed_title,
          slug: finalSlug,
          content: c.proposed_content,
        });
        return { error };
      }
      if (!c.section_id) return { error: 'Missing section for this change.' };
      return updateSection(c.section_id, { title: c.proposed_title, content: c.proposed_content });
    });
    if (error) showToast(error, 'error');
    else showToast('Change approved and published', 'success');
    return { error };
  }

  async function handleRejectChange(change: SectionPendingChange, note?: string) {
    const { error } = await reject(change, note);
    if (error) showToast(error, 'error');
    else showToast('Change rejected', 'success');
    return { error };
  }

  const gated = !isTeam && gate !== null;

  return (
    <div className="flex min-h-screen flex-col" style={accentStyle}>
      <ProjectHeader title={project.title} iconUrl={project.icon_url} />

      {gated ? (
        <Suspense fallback={<FullPageSpinner label="Loading…" />}>
          <ProjectAccessGate project={project} gate={gate} onUnlocked={retryAfterUnlock} />
        </Suspense>
      ) : (
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          project={project}
          sections={visibleSections}
          activeSlug={activeSection?.slug}
          role={role}
          onReorder={handleReorder}
          onAddSection={() => {
            setInsertAfterSection(null);
            setAddDialogOpen(true);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenTeam={() => setTeamOpen(true)}
          onOpenReviewQueue={() => setReviewQueueOpen(true)}
          pendingReviewCount={pendingCount}
          onInsertAfter={handleRequestInsertAfter}
          onDuplicate={handleDuplicateSection}
          onDeleteSection={canDelete ? handleRequestDelete : undefined}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onDuplicateToProject={setDuplicateToProjectSection}
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
                  canEdit
                    ? 'Add your first section to start building this documentation.'
                    : 'This project has no published sections yet.'
                }
                action={
                  canEdit ? (
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
                    <h1 className="font-display text-2xl font-semibold tracking-tight">{activeSection.title}</h1>
                    <div className="flex shrink-0 items-center gap-2">
                      {!editing && (
                        <TranslateButton
                          sourceText={activeSection.content}
                          onTranslated={setTranslatedContent}
                          enabledLanguages={project.enabled_languages}
                        />
                      )}
                      {!editing && canLeaveComment && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReaderCommentsOpen((prev) => !prev)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Comments
                        </Button>
                      )}
                      {!editing && !canLeaveComment && (
                        <Button variant="outline" size="sm" onClick={() => setSuggestOpen(true)}>
                          <Lightbulb className="h-3.5 w-3.5" />
                          Suggest an improvement
                        </Button>
                      )}
                      {canEdit && (
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

                  {editing && canEdit ? (
                    <div className="flex-1 overflow-hidden">
                      <Suspense fallback={<PanelLoading />}>
                        <MarkdownEditor
                          key={activeSection.id}
                          initialContent={activeSection.content}
                          onSave={handleSaveContent}
                          sectionId={activeSection.id}
                          isOwner={isOwner}
                          project={project}
                          section={activeSection}
                          role={role}
                          mentionCandidates={mentionCandidates}
                          saveLabel={canPublishDirectly ? undefined : 'Submits for review'}
                        />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="flex flex-1 gap-4 overflow-hidden">
                      <div className="flex-1 overflow-y-auto scrollbar-thin">
                        <TocPanel content={translatedContent ?? activeSection.content} className="mb-4" />
                        <div
                          className="doclix-prose"
                          data-no-translate
                          dangerouslySetInnerHTML={{
                            __html:
                              renderMarkdown(translatedContent ?? activeSection.content) ||
                              '<p class="text-muted-foreground">This section has no content yet.</p>',
                          }}
                        />
                        <SectionFooterNav
                          projectSlug={project.slug}
                          prev={prevSection}
                          next={nextSection}
                        />
                      </div>
                      {readerCommentsOpen && canLeaveComment && (
                        <Suspense fallback={<PanelLoading />}>
                          <CommentsPanel
                            open={readerCommentsOpen}
                            onClose={() => setReaderCommentsOpen(false)}
                            sectionId={activeSection.id}
                            project={project}
                            section={activeSection}
                            role={role}
                            mentionCandidates={mentionCandidates}
                          />
                        </Suspense>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Team-editing-capable dialogs. Gated on canEdit/canManageSettings/
          canManageTeam (not just their `open` prop) so readers -- everyone
          hitting the pre-rendered doc HTML -- never trigger these lazy
          imports at all; a reader can never open them anyway since the
          buttons that would are themselves role-gated. */}
      {canEdit && (
        <Suspense fallback={null}>
          <AddSectionDialog
            open={addDialogOpen}
            onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (!open) setInsertAfterSection(null);
            }}
            onCreate={handleCreateSection}
            onCreateMultiple={handleCreateMultipleSections}
            insertAfterTitle={insertAfterSection?.title ?? null}
          />

          <DuplicateToProjectDialog
            open={!!duplicateToProjectSection}
            onOpenChange={(open) => {
              if (!open) setDuplicateToProjectSection(null);
            }}
            section={duplicateToProjectSection}
            currentProjectId={project.id}
            onDuplicated={(targetProject) => {
              showToast(`Duplicated into "${targetProject.title}"`, 'success');
            }}
          />
        </Suspense>
      )}

      {canManageSettings && (
        <Suspense fallback={null}>
          <ProjectSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            project={project}
            sections={sections}
            isOwner={isOwner}
            onRenameSection={handleRenameSection}
            onDeleteSection={handleDeleteSection}
            onToggleSectionHidden={handleToggleSectionHidden}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
          />
        </Suspense>
      )}

      {canManageTeam && (
        <Suspense fallback={null}>
          <TeamMembersDialog open={teamOpen} onOpenChange={setTeamOpen} project={project} currentUserRole={role} />
          <ReviewQueueDialog
            open={reviewQueueOpen}
            onOpenChange={setReviewQueueOpen}
            changes={pendingChanges}
            sections={sections}
            submitterName={submitterName}
            onApprove={handleApproveChange}
            onReject={handleRejectChange}
          />
        </Suspense>
      )}

      {!canLeaveComment && activeSection && (
        <Suspense fallback={null}>
          <SuggestImprovementDialog
            open={suggestOpen}
            onOpenChange={setSuggestOpen}
            project={project}
            section={activeSection}
          />
        </Suspense>
      )}
    </div>
  );
}
