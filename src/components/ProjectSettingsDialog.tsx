import { useEffect, useRef, useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  Save,
  Upload,
  X,
  Eye,
  EyeOff,
  Palette,
  Lock,
  Search as SearchIcon,
  Globe2,
  Settings as SettingsIcon,
  Code2,
} from 'lucide-react';
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
import { Switch } from '@/components/ui/Switch';
import { ProjectIcon } from '@/components/ProjectIcon';
import { useAuth } from '@/contexts/AuthContext';
import { uploadProjectIcon, ImageUploadError } from '@/lib/imageUpload';
import { COMMON_LANGUAGES } from '@/lib/translate';
import { cn } from '@/lib/utils';
import type { Project, ProjectUpdate, ProjectVisibility, Section } from '@/types/database';

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  sections: Section[];
  isOwner?: boolean;
  onRenameSection: (id: string, title: string) => Promise<{ error: string | null }>;
  onDeleteSection: (id: string) => Promise<{ error: string | null }>;
  onToggleSectionHidden: (id: string, hidden: boolean) => Promise<{ error: string | null }>;
  onDeleteProject: () => Promise<{ error: string | null }>;
  onUpdateProject: (updates: ProjectUpdate) => Promise<{ error: string | null }>;
}

type TabId = 'general' | 'appearance' | 'access' | 'seo' | 'localization';

const TABS: { id: TabId; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'access', label: 'Access', icon: Lock },
  { id: 'seo', label: 'SEO', icon: SearchIcon },
  { id: 'localization', label: 'Localization', icon: Globe2 },
];

const DEFAULT_ACCENT = '#6366f1';

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
  sections,
  isOwner = true,
  onRenameSection,
  onDeleteSection,
  onToggleSectionHidden,
  onDeleteProject,
  onUpdateProject,
}: ProjectSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, session } = useAuth();

  // -- General ------------------------------------------------------------
  const [projectTitle, setProjectTitle] = useState(project.title);
  const [projectDescription, setProjectDescription] = useState(project.description ?? '');
  const [savingProject, setSavingProject] = useState(false);
  const [projectSaved, setProjectSaved] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // -- Appearance -----------------------------------------------------------
  const [accentColor, setAccentColor] = useState(project.accent_color ?? '');
  const [customFooter, setCustomFooter] = useState(project.custom_footer ?? '');
  const [hideBranding, setHideBranding] = useState(project.hide_branding);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState(false);

  // -- Access ---------------------------------------------------------------
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessSaved, setAccessSaved] = useState(false);
  // Client never receives password_hash (see types/database.ts), so
  // "does a password already exist" is tracked here instead, purely to
  // pick the right label/placeholder copy -- it starts out assuming
  // "maybe" whenever visibility is already 'password' (safe default:
  // show the less alarming "leave blank to keep current" copy) and
  // becomes definite the moment this dialog itself sets or clears one.
  const [hasPassword, setHasPassword] = useState(project.visibility === 'password');

  // -- SEO --------------------------------------------------------------------
  const [ogImageUrl, setOgImageUrl] = useState(project.og_image_url ?? '');
  const [sitemapExcluded, setSitemapExcluded] = useState(project.sitemap_excluded);
  const [headSnippet, setHeadSnippet] = useState(project.custom_head_snippet ?? '');
  const [savingSeo, setSavingSeo] = useState(false);
  const [seoSaved, setSeoSaved] = useState(false);

  // -- Localization -----------------------------------------------------------
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>(project.enabled_languages ?? []);
  const [savingLocalization, setSavingLocalization] = useState(false);
  const [localizationSaved, setLocalizationSaved] = useState(false);

  const projectDirty = projectTitle !== project.title || projectDescription !== (project.description ?? '');
  const appearanceDirty =
    accentColor !== (project.accent_color ?? '') ||
    customFooter !== (project.custom_footer ?? '') ||
    hideBranding !== project.hide_branding;
  const accessDirty = visibility !== project.visibility || newPassword.length > 0;
  const seoDirty =
    ogImageUrl !== (project.og_image_url ?? '') ||
    sitemapExcluded !== project.sitemap_excluded ||
    headSnippet !== (project.custom_head_snippet ?? '');
  const localizationDirty =
    JSON.stringify([...enabledLanguages].sort()) !== JSON.stringify([...(project.enabled_languages ?? [])].sort());

  useEffect(() => {
    if (open) {
      setProjectTitle(project.title);
      setProjectDescription(project.description ?? '');
      setAccentColor(project.accent_color ?? '');
      setCustomFooter(project.custom_footer ?? '');
      setHideBranding(project.hide_branding);
      setVisibility(project.visibility);
      setHasPassword(project.visibility === 'password');
      setNewPassword('');
      setOgImageUrl(project.og_image_url ?? '');
      setSitemapExcluded(project.sitemap_excluded);
      setHeadSnippet(project.custom_head_snippet ?? '');
      setEnabledLanguages(project.enabled_languages ?? []);
      setActiveTab('general');
      setError(null);
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

  async function handleSaveAppearance() {
    setSavingAppearance(true);
    setError(null);
    const { error } = await onUpdateProject({
      accent_color: accentColor || null,
      custom_footer: customFooter.trim() || null,
      hide_branding: hideBranding,
    });
    setSavingAppearance(false);
    if (error) {
      setError(error);
    } else {
      setAppearanceSaved(true);
      setTimeout(() => setAppearanceSaved(false), 2000);
    }
  }

  async function callProjectPasswordEndpoint(newPasswordOrNull: string | null): Promise<string | null> {
    const accessToken = session?.access_token;
    if (!accessToken) return 'You must be signed in to change the password.';
    try {
      const res = await fetch('/api/project-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId: project.id, newPassword: newPasswordOrNull }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) return body.error ?? 'Failed to update password.';
      return null;
    } catch {
      return 'Failed to update password.';
    }
  }

  async function handleSaveAccess() {
    if (visibility === 'password' && !newPassword && !hasPassword) {
      setError('Set a password to use password-protected visibility.');
      return;
    }

    setSavingAccess(true);
    setError(null);

    // The password itself is set/cleared via a dedicated, service-role
    // backed endpoint (functions/api/project-password.ts) that hashes it
    // server-side with a pepper the browser never sees -- this dialog
    // only ever handles the plaintext in memory for the length of this
    // one request, the same as a normal password-change form.
    if (visibility === 'password' && newPassword) {
      const passwordError = await callProjectPasswordEndpoint(newPassword);
      if (passwordError) {
        setSavingAccess(false);
        setError(passwordError);
        return;
      }
      setHasPassword(true);
    } else if (visibility !== 'password' && hasPassword) {
      // Switching away from password protection clears any stored hash
      // so a later switch back doesn't silently reuse a stale/forgotten
      // password.
      const passwordError = await callProjectPasswordEndpoint(null);
      if (passwordError) {
        setSavingAccess(false);
        setError(passwordError);
        return;
      }
      setHasPassword(false);
    }

    const updates: ProjectUpdate = { visibility };
    const { error } = await onUpdateProject(updates);
    setSavingAccess(false);
    if (error) {
      setError(error);
    } else {
      setNewPassword('');
      setAccessSaved(true);
      setTimeout(() => setAccessSaved(false), 2000);
    }
  }

  async function handleSaveSeo() {
    setSavingSeo(true);
    setError(null);
    const { error } = await onUpdateProject({
      og_image_url: ogImageUrl.trim() || null,
      sitemap_excluded: sitemapExcluded,
      custom_head_snippet: headSnippet.trim() || null,
    });
    setSavingSeo(false);
    if (error) {
      setError(error);
    } else {
      setSeoSaved(true);
      setTimeout(() => setSeoSaved(false), 2000);
    }
  }

  async function handleSaveLocalization() {
    setSavingLocalization(true);
    setError(null);
    const { error } = await onUpdateProject({ enabled_languages: enabledLanguages });
    setSavingLocalization(false);
    if (error) {
      setError(error);
    } else {
      setLocalizationSaved(true);
      setTimeout(() => setLocalizationSaved(false), 2000);
    }
  }

  function toggleLanguage(code: string) {
    setEnabledLanguages((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleIconSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    setUploadingIcon(true);
    setError(null);
    try {
      const url = await uploadProjectIcon(file, user.id);
      const { error } = await onUpdateProject({ icon_url: url });
      if (error) setError(error);
    } catch (err) {
      setError(err instanceof ImageUploadError ? err.message : 'Failed to upload icon.');
    } finally {
      setUploadingIcon(false);
    }
  }

  async function handleRemoveIcon() {
    setUploadingIcon(true);
    setError(null);
    const { error } = await onUpdateProject({ icon_url: null });
    if (error) setError(error);
    setUploadingIcon(false);
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

  async function handleToggleHidden(section: Section) {
    const { error } = await onToggleSectionHidden(section.id, !section.hidden);
    if (error) setError(error);
  }

  async function handleDeleteProject() {
    setBusy(true);
    const { error } = await onDeleteProject();
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Configure how this documentation looks, behaves, and who can see it.</DialogDescription>
        </DialogHeader>

        {error && (
          <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="max-h-[26rem] overflow-y-auto scrollbar-thin pr-1">
          {activeTab === 'general' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <ProjectIcon iconUrl={project.icon_url} size="lg" />
                  <div className="flex flex-col gap-1">
                    <Label>Project icon</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => iconInputRef.current?.click()}
                        loading={uploadingIcon}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {project.icon_url ? 'Replace icon' : 'Upload icon'}
                      </Button>
                      {project.icon_url && (
                        <button
                          type="button"
                          onClick={handleRemoveIcon}
                          disabled={uploadingIcon}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                          title="Remove icon"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <input
                        ref={iconInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleIconSelected}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">PNG, JPG, GIF, WEBP, or SVG. Falls back to the default icon if none is set.</p>
                  </div>
                </div>
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

              <div>
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sections
                </div>
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto scrollbar-thin">
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
                            className={cn(
                              'flex-1 truncate text-left text-sm hover:text-primary',
                              section.hidden && 'text-muted-foreground italic'
                            )}
                            onClick={() => startEdit(section)}
                          >
                            {section.title}
                            {section.hidden && <span className="ml-1.5 text-[10px] not-italic">(hidden)</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHidden(section)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            title={section.hidden ? 'Show in navigation' : 'Hide from navigation'}
                          >
                            {section.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
              </div>

              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Danger zone
                </div>
                {isOwner ? (
                  <>
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
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only the project owner can delete this project.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>Accent color</Label>
                <p className="text-xs text-muted-foreground">
                  Overrides the primary color used for links, buttons, and highlights across this project's docs.
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor || DEFAULT_ACCENT}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#6366f1 (default theme color)"
                    className="max-w-[10rem]"
                  />
                  {accentColor && (
                    <Button size="sm" variant="ghost" onClick={() => setAccentColor('')}>
                      Reset to default
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="custom-footer">Custom footer text</Label>
                <p className="text-xs text-muted-foreground">
                  Shown at the bottom of the sidebar. Leave blank to show nothing extra.
                </p>
                <Input
                  id="custom-footer"
                  value={customFooter}
                  onChange={(e) => setCustomFooter(e.target.value)}
                  placeholder="© 2026 Acme Inc."
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="hide-branding">Hide "Powered by DOCLIX"</Label>
                  <p className="text-xs text-muted-foreground">Remove the Doclix badge from the sidebar footer.</p>
                </div>
                <Switch id="hide-branding" checked={hideBranding} onCheckedChange={setHideBranding} />
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveAppearance} disabled={!appearanceDirty} loading={savingAppearance}>
                  <Save className="h-3.5 w-3.5" />
                  Save appearance
                </Button>
                {appearanceSaved && <span className="text-xs text-green-500">Saved</span>}
              </div>
            </div>
          )}

          {activeTab === 'access' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>Visibility</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: 'public', label: 'Public', desc: 'Anyone with the link can view.' },
                      { value: 'private', label: 'Private', desc: 'Only you can view.' },
                      { value: 'password', label: 'Password', desc: 'Visitors must enter a password.' },
                    ] as { value: ProjectVisibility; label: string; desc: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVisibility(opt.value)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors duration-200',
                        visibility === opt.value
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {visibility === 'password' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="project-password">
                    {hasPassword ? 'Set a new password' : 'Set a password'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="project-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={hasPassword ? 'Leave blank to keep current password' : 'Choose a password'}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Visitors will be asked for this password before they can read any section.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveAccess} disabled={!accessDirty} loading={savingAccess}>
                  <Save className="h-3.5 w-3.5" />
                  Save access settings
                </Button>
                {accessSaved && <span className="text-xs text-green-500">Saved</span>}
              </div>
            </div>
          )}

          {activeTab === 'seo' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="og-image">Social preview image (OG image)</Label>
                <p className="text-xs text-muted-foreground">
                  Shown when links to this project are shared on Slack, Twitter/X, Discord, etc.
                </p>
                <Input
                  id="og-image"
                  value={ogImageUrl}
                  onChange={(e) => setOgImageUrl(e.target.value)}
                  placeholder="https://example.com/og-image.png"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="sitemap-excluded">Exclude from sitemap</Label>
                  <p className="text-xs text-muted-foreground">
                    Keeps this project out of sitemap.xml so search engines won't be pointed to it.
                  </p>
                </div>
                <Switch id="sitemap-excluded" checked={sitemapExcluded} onCheckedChange={setSitemapExcluded} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="head-snippet" className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" />
                  Custom &lt;head&gt; snippet
                </Label>
                <p className="text-xs text-muted-foreground">
                  Injected into the page head for this project only — useful for analytics scripts or extra meta
                  tags. Renders on public pages, so only paste snippets you trust.
                </p>
                <Textarea
                  id="head-snippet"
                  value={headSnippet}
                  onChange={(e) => setHeadSnippet(e.target.value)}
                  placeholder={'<script defer data-domain="docs.example.com" src="https://plausible.io/js/script.js"></script>'}
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveSeo} disabled={!seoDirty} loading={savingSeo}>
                  <Save className="h-3.5 w-3.5" />
                  Save SEO settings
                </Button>
                {seoSaved && <span className="text-xs text-green-500">Saved</span>}
              </div>
            </div>
          )}

          {activeTab === 'localization' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>Enabled languages</Label>
                <p className="text-xs text-muted-foreground">
                  Restrict the translate menu readers see to just these languages. Leave all unchecked to offer
                  every supported language.
                </p>
                <div className="mt-1 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto scrollbar-thin rounded-lg border border-border p-2 sm:grid-cols-3">
                  {COMMON_LANGUAGES.filter((l) => l.code !== 'en').map((lang) => (
                    <label
                      key={lang.code}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
                    >
                      <input
                        type="checkbox"
                        checked={enabledLanguages.includes(lang.code)}
                        onChange={() => toggleLanguage(lang.code)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      {lang.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveLocalization}
                  disabled={!localizationDirty}
                  loading={savingLocalization}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save localization
                </Button>
                {localizationSaved && <span className="text-xs text-green-500">Saved</span>}
              </div>
            </div>
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
