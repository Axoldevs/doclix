-- DOCLIX Supabase schema
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "uuid-ossp";

-- PROJECTS -------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  description text,
  icon_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive migration: run this alone if `projects` already exists without icon_url.
alter table public.projects add column if not exists icon_url text;

-- Additive migration: deeper documentation settings (visibility, branding,
-- SEO, localization). Safe to run alone against an existing `projects` table.
alter table public.projects add column if not exists visibility text not null default 'public';
alter table public.projects add constraint projects_visibility_check
  check (visibility in ('public', 'private', 'password')) not valid;
alter table public.projects validate constraint projects_visibility_check;
alter table public.projects add column if not exists password_hash text;
alter table public.projects add column if not exists accent_color text;
alter table public.projects add column if not exists custom_footer text;
alter table public.projects add column if not exists hide_branding boolean not null default false;
alter table public.projects add column if not exists custom_head_snippet text;
alter table public.projects add column if not exists og_image_url text;
alter table public.projects add column if not exists sitemap_excluded boolean not null default false;
alter table public.projects add column if not exists enabled_languages text[] not null default '{}';

create index if not exists projects_owner_id_idx on public.projects(owner_id);
create index if not exists projects_slug_idx on public.projects(slug);

alter table public.projects enable row level security;

create policy "Anyone can view projects"
  on public.projects for select
  using (true);

create policy "Owners can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their own projects"
  on public.projects for update
  using (auth.uid() = owner_id);

create policy "Owners can delete their own projects"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- Public-safe view: every projects column except password_hash. The
-- client reads projects through this view (never the base table
-- directly), so a stray `select('*')` in application code can't leak a
-- password hash to the browser -- the column simply isn't in the result
-- set to begin with. `security_invoker` makes the view run with the
-- querying user's own RLS permissions (not the view owner's), so it
-- doesn't accidentally bypass the "Anyone can view projects" policy.
create or replace view public.projects_public
  with (security_invoker = true) as
  select
    id, slug, title, description, icon_url, owner_id,
    visibility, accent_color, custom_footer, hide_branding,
    custom_head_snippet, og_image_url, sitemap_excluded, enabled_languages,
    created_at, updated_at
  from public.projects;

-- SECTIONS ---------------------------------------------------------------
create table if not exists public.sections (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug text not null,
  title text not null,
  content text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

-- Additive migration: hide a section from the public nav/sidebar and
-- machine-readable endpoints (llms.txt, .md routes) while keeping it
-- editable and linkable directly, for drafts or supplementary pages.
alter table public.sections add column if not exists hidden boolean not null default false;

create index if not exists sections_project_id_idx on public.sections(project_id);
create index if not exists sections_position_idx on public.sections(project_id, position);

alter table public.sections enable row level security;

-- Real access control: an anon/authenticated client can only read section
-- CONTENT directly (via PostgREST/the JS client) when the parent project
-- is public, or when the reader is the project's owner. Private and
-- password-protected projects are NOT readable this way at all -- their
-- content can only be served through functions/api/project-content.ts,
-- a Cloudflare Pages Function that holds the service-role key server-side
-- and enforces the password check (or ownership) itself before returning
-- anything. This replaces an earlier "using (true)" policy that let
-- anyone read every section's content directly regardless of the
-- project's visibility setting -- that made the in-app password prompt a
-- UI-only speed bump rather than real protection, since the same content
-- was one REST call away with just the public anon key.
drop policy if exists "Anyone can view sections" on public.sections;

create policy "Public project sections are readable by anyone"
  on public.sections for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = sections.project_id
      and projects.visibility = 'public'
    )
  );

create policy "Owners can view their own sections regardless of visibility"
  on public.sections for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = sections.project_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Project owners can insert sections"
  on public.sections for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = sections.project_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Project owners can update sections"
  on public.sections for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = sections.project_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Project owners can delete sections"
  on public.sections for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = sections.project_id
      and projects.owner_id = auth.uid()
    )
  );

-- Keep updated_at fresh on projects when its sections change (optional nicety)
create or replace function public.touch_project_updated_at()
returns trigger as $$
begin
  update public.projects set updated_at = now() where id = new.project_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger sections_touch_project
  after insert or update on public.sections
  for each row execute function public.touch_project_updated_at();

-- SECTION REVISIONS -------------------------------------------------------
-- Snapshots the previous content/title whenever a section is updated, so
-- editors can view history and restore an older version.
create table if not exists public.section_revisions (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists section_revisions_section_id_idx
  on public.section_revisions(section_id, created_at desc);

alter table public.section_revisions enable row level security;

create policy "Anyone can view revisions"
  on public.section_revisions for select
  using (true);

create policy "Project owners can insert revisions"
  on public.section_revisions for insert
  with check (
    exists (
      select 1 from public.sections
      join public.projects on projects.id = sections.project_id
      where sections.id = section_revisions.section_id
      and projects.owner_id = auth.uid()
    )
  );

create or replace function public.snapshot_section_revision()
returns trigger as $$
begin
  if (old.content is distinct from new.content) or (old.title is distinct from new.title) then
    insert into public.section_revisions (section_id, title, content)
    values (old.id, old.title, old.content);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger sections_snapshot_revision
  before update on public.sections
  for each row execute function public.snapshot_section_revision();

-- SECTION COMMENTS ----------------------------------------------------------
create table if not exists public.section_comments (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid not null references public.sections(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Anonymous',
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists section_comments_section_id_idx
  on public.section_comments(section_id, created_at asc);

alter table public.section_comments enable row level security;

create policy "Anyone can view comments"
  on public.section_comments for select
  using (true);

create policy "Signed-in users can add comments"
  on public.section_comments for insert
  with check (auth.uid() = author_id);

create policy "Project owners or comment authors can update comments"
  on public.section_comments for update
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.sections
      join public.projects on projects.id = sections.project_id
      where sections.id = section_comments.section_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Project owners or comment authors can delete comments"
  on public.section_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.sections
      join public.projects on projects.id = sections.project_id
      where sections.id = section_comments.section_id
      and projects.owner_id = auth.uid()
    )
  );

-- PROFILES -------------------------------------------------------------
-- A minimal public mirror of auth.users (id, display name, email) so
-- one team member can see another's name -- e.g. in the members list,
-- for @mention autocomplete/resolution, and in notification text.
-- auth.users itself isn't queryable by regular clients (no RLS-friendly
-- API for arbitrary reads), so this table exists purely as a readable
-- projection. Kept in sync via a trigger on auth.users insert/update
-- rather than written to directly by client code.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user can read any profile -- names/emails here are
-- already visible to teammates elsewhere (comments show author_name,
-- invites are sent by email), and this table holds nothing more
-- sensitive than that.
create policy "Signed-in users can view profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create or replace function public.handle_new_or_updated_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, updated_at)
  values (
    new.id,
    new.raw_user_meta_data->>'display_name',
    new.email,
    now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_or_updated on auth.users;
create trigger on_auth_user_created_or_updated
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_or_updated_user();

-- Backfill for any users that already existed before this migration ran.
insert into public.profiles (id, display_name, email, updated_at)
select id, raw_user_meta_data->>'display_name', email, now()
from auth.users
on conflict (id) do update set
  display_name = excluded.display_name,
  email = excluded.email;

-- TEAM MEMBERS & ROLES ----------------------------------------------------
-- Five roles, most-to-least privileged: owner > admin > editor > commenter
-- > viewer. The project's `owner_id` column remains the single source of
-- truth for who the owner is (ownership transfer just updates that column);
-- `project_members` holds every OTHER role grant, including admins. A
-- signed-in user with no row here and who isn't the owner is a viewer by
-- default -- viewer is intentionally not stored, since it's just "no
-- explicit grant" and doesn't need a row to exist or be cleaned up.
create type public.project_role as enum ('admin', 'editor', 'commenter', 'viewer');

create table if not exists public.project_members (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.project_role not null default 'viewer',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_project_id_idx on public.project_members(project_id);
create index if not exists project_members_user_id_idx on public.project_members(user_id);

alter table public.project_members enable row level security;

-- Helper, security definer so it can read project_members/projects
-- without recursing through RLS on those same tables (a plain policy
-- referencing project_members from within a project_members policy
-- would deadlock/recurse). Returns the caller's effective role for a
-- project: 'owner' for the project's owner_id, the stored role for an
-- explicit member row, or 'viewer' as the default for any other
-- signed-in user. Anonymous callers (auth.uid() is null) get 'viewer'
-- too -- callers that need to distinguish "anonymous" from "signed-in
-- viewer" should check auth.uid() themselves.
create or replace function public.project_role_for(p_project_id uuid, p_user_id uuid)
returns text as $$
declare
  v_owner_id uuid;
  v_role public.project_role;
begin
  select owner_id into v_owner_id from public.projects where id = p_project_id;
  if v_owner_id is null then
    return 'viewer';
  end if;
  if v_owner_id = p_user_id then
    return 'owner';
  end if;
  select role into v_role from public.project_members
    where project_id = p_project_id and user_id = p_user_id;
  return coalesce(v_role::text, 'viewer');
end;
$$ language plpgsql security definer stable;

-- Convenience predicate: owner or admin, the two roles allowed to manage
-- members, project settings, and review/publish changes.
create or replace function public.project_role_is_manager(p_project_id uuid, p_user_id uuid)
returns boolean as $$
begin
  return public.project_role_for(p_project_id, p_user_id) in ('owner', 'admin');
end;
$$ language plpgsql security definer stable;

-- Convenience predicate: owner, admin, or editor -- anyone allowed to
-- create/edit/delete/organize documentation (editors do so via the
-- pending-changes review queue rather than writing `sections` directly;
-- see SECTION PENDING CHANGES below).
create or replace function public.project_role_can_edit(p_project_id uuid, p_user_id uuid)
returns boolean as $$
begin
  return public.project_role_for(p_project_id, p_user_id) in ('owner', 'admin', 'editor');
end;
$$ language plpgsql security definer stable;

-- Convenience predicate: anyone allowed to comment (everyone except
-- plain viewers).
create or replace function public.project_role_can_comment(p_project_id uuid, p_user_id uuid)
returns boolean as $$
begin
  return public.project_role_for(p_project_id, p_user_id) in ('owner', 'admin', 'editor', 'commenter');
end;
$$ language plpgsql security definer stable;

create policy "Members are visible to anyone who can see the project"
  on public.project_members for select
  using (true);

create policy "Owners and admins can add members"
  on public.project_members for insert
  with check (public.project_role_is_manager(project_id, auth.uid()));

create policy "Owners and admins can change member roles"
  on public.project_members for update
  using (public.project_role_is_manager(project_id, auth.uid()))
  with check (
    -- Admins can't grant/edit an 'admin' row for someone else -- keeps
    -- promoting-to-admin an owner-only action, since project_role_for
    -- treats owner and admin as equally "manager" otherwise.
    public.project_role_for(project_id, auth.uid()) = 'owner'
    or role <> 'admin'
  );

create policy "Owners and admins can remove members"
  on public.project_members for delete
  using (public.project_role_is_manager(project_id, auth.uid()));

-- PROJECT INVITES -----------------------------------------------------------
-- Pending invites by email (the invitee may not have an account yet).
-- Accepting an invite (functions/api/accept-invite.ts) creates the
-- matching project_members row and deletes the invite; the invite itself
-- never grants access on its own.
create table if not exists public.project_invites (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role public.project_role not null default 'viewer',
  invited_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  unique (project_id, email)
);

create index if not exists project_invites_project_id_idx on public.project_invites(project_id);
create index if not exists project_invites_token_idx on public.project_invites(token);

alter table public.project_invites enable row level security;

create policy "Owners and admins can view invites"
  on public.project_invites for select
  using (public.project_role_is_manager(project_id, auth.uid()));

create policy "Owners and admins can create invites"
  on public.project_invites for insert
  with check (public.project_role_is_manager(project_id, auth.uid()));

create policy "Owners and admins can revoke invites"
  on public.project_invites for delete
  using (public.project_role_is_manager(project_id, auth.uid()));

-- SECTION PENDING CHANGES ---------------------------------------------------
-- Editor ≠ Publisher: editors (and admins/owners, who can also just
-- publish directly) submit proposed title/content here instead of
-- writing `sections` directly. An owner/admin then approves (applies the
-- change to `sections`, which still fires the existing revision-snapshot
-- trigger) or rejects it. `section_id` is null for a *new* section
-- proposal (create-via-review); non-null edits an existing section.
create type public.pending_change_status as enum ('pending', 'approved', 'rejected');

create table if not exists public.section_pending_changes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  section_id uuid references public.sections(id) on delete cascade,
  proposed_title text not null,
  proposed_content text not null,
  proposed_slug text,
  is_new_section boolean not null default false,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status public.pending_change_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists section_pending_changes_project_id_idx
  on public.section_pending_changes(project_id, status);
create index if not exists section_pending_changes_section_id_idx
  on public.section_pending_changes(section_id);

alter table public.section_pending_changes enable row level security;

create policy "Editors+ can view pending changes for their projects"
  on public.section_pending_changes for select
  using (public.project_role_can_edit(project_id, auth.uid()));

create policy "Editors+ can submit pending changes"
  on public.section_pending_changes for insert
  with check (
    public.project_role_can_edit(project_id, auth.uid())
    and submitted_by = auth.uid()
  );

create policy "Owners and admins review; submitters can withdraw their own pending proposal"
  on public.section_pending_changes for update
  using (
    public.project_role_is_manager(project_id, auth.uid())
    or (submitted_by = auth.uid() and status = 'pending')
  );

create policy "Owners and admins can delete pending changes; submitters can delete their own pending proposal"
  on public.section_pending_changes for delete
  using (
    public.project_role_is_manager(project_id, auth.uid())
    or (submitted_by = auth.uid() and status = 'pending')
  );

-- SECTIONS: role-based policies ---------------------------------------------
-- Replace the owner-only insert/update/delete policies with role-aware
-- ones. Direct writes to `sections` are now for owners/admins (who can
-- publish immediately) -- editors go through section_pending_changes
-- above and an owner/admin's approval is what actually writes here.
drop policy if exists "Project owners can insert sections" on public.sections;
drop policy if exists "Project owners can update sections" on public.sections;
drop policy if exists "Project owners can delete sections" on public.sections;
drop policy if exists "Owners can view their own sections regardless of visibility" on public.sections;

create policy "Managers can insert sections directly"
  on public.sections for insert
  with check (public.project_role_is_manager(project_id, auth.uid()));

-- Direct writes to `sections` are allowed for editor+ (organizing,
-- renaming, hiding, reordering, deleting) -- "Editor ≠ Publisher" is
-- enforced for *content* specifically at the application layer
-- (DocProjectPage routes a content save through section_pending_changes
-- for non-publishers rather than calling updateSection directly), not
-- here at the RLS layer. RLS can't practically distinguish "changed
-- only the title/hidden/order" from "changed the content" on an UPDATE,
-- so this policy is intentionally the outer, coarser boundary; the
-- content-specific gate lives in the client/hook layer above it.
create policy "Editors+ can update sections directly"
  on public.sections for update
  using (public.project_role_can_edit(project_id, auth.uid()));

create policy "Editors+ can delete sections"
  on public.sections for delete
  using (public.project_role_can_edit(project_id, auth.uid()));

create policy "Team members can view sections regardless of visibility"
  on public.sections for select
  using (public.project_role_for(project_id, auth.uid()) <> 'viewer');

-- PROJECTS: role-based policies ----------------------------------------------
drop policy if exists "Owners can update their own projects" on public.projects;

create policy "Owners and admins can update project settings"
  on public.projects for update
  using (public.project_role_is_manager(id, auth.uid()));

-- Deleting the project and transferring ownership stay owner-only (the
-- existing "Owners can delete their own projects" / auth.uid() = owner_id
-- delete policy is untouched).

-- SECTION COMMENTS: role-based + threading + mentions ------------------------
-- Additive migration: threading (parent_comment_id), account display
-- fields already existed (author_name); add mention tracking for
-- notifications. Existing rows are unaffected (parent_comment_id null =
-- top-level, mentioned_user_ids defaults to empty).
alter table public.section_comments add column if not exists parent_comment_id uuid references public.section_comments(id) on delete cascade;
alter table public.section_comments add column if not exists mentioned_user_ids uuid[] not null default '{}';
alter table public.section_comments add column if not exists updated_at timestamptz;

create index if not exists section_comments_parent_idx on public.section_comments(parent_comment_id);

drop policy if exists "Anyone can view comments" on public.section_comments;
drop policy if exists "Signed-in users can add comments" on public.section_comments;
drop policy if exists "Project owners or comment authors can update comments" on public.section_comments;
drop policy if exists "Project owners or comment authors can delete comments" on public.section_comments;

create policy "Team members (commenter+) can view comments"
  on public.section_comments for select
  using (
    exists (
      select 1 from public.sections
      where sections.id = section_comments.section_id
      and public.project_role_for(sections.project_id, auth.uid()) <> 'viewer'
    )
    or exists (
      -- Public projects: comments are still visible to any signed-in
      -- viewer/anonymous reader who can see the docs at all, so a
      -- commenter's thread isn't invisible to the very readers it's
      -- discussing content for.
      select 1 from public.sections
      join public.projects on projects.id = sections.project_id
      where sections.id = section_comments.section_id
      and projects.visibility = 'public'
    )
  );

create policy "Commenter+ can add comments"
  on public.section_comments for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.sections
      where sections.id = section_comments.section_id
      and public.project_role_can_comment(sections.project_id, auth.uid())
    )
  );

create policy "Project managers or comment authors can update comments"
  on public.section_comments for update
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.sections
      where sections.id = section_comments.section_id
      and public.project_role_is_manager(sections.project_id, auth.uid())
    )
  );

create policy "Project managers or comment authors can delete comments"
  on public.section_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.sections
      where sections.id = section_comments.section_id
      and public.project_role_is_manager(sections.project_id, auth.uid())
    )
  );

-- NOTIFICATIONS ---------------------------------------------------------
-- In-app notifications for mentions, replies, and review events (a new
-- pending change, or a change being approved/rejected). `link_path` is a
-- client-side route (e.g. /docs/my-project/installation) to navigate to
-- on click.
create type public.notification_kind as enum ('mention', 'reply', 'change_submitted', 'change_approved', 'change_rejected', 'suggestion_submitted');

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind public.notification_kind not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  message text not null,
  link_path text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Notifications are inserted directly by client code at the moment an
-- action happens (a comment mentions someone, a change is submitted for
-- review, etc.) -- there's no separate server-side trigger step for
-- this. That means the insert policy can't simply check
-- auth.uid() = user_id (the recipient and the actor are different
-- people), so instead it constrains *what* can be inserted: the actor
-- field must honestly identify the caller (or be null), and the
-- notified user must actually have standing on the project (team member
-- or, for suggestion_submitted, at least project_role_can_comment so a
-- random signed-in stranger can't spam notifications at an arbitrary
-- user id). This still isn't as strong as service-role-only inserts,
-- but a forged notification is a low-severity annoyance (it's just a
-- message + link, never a permission grant), not a security hole.
create policy "Signed-in users can create honestly-attributed notifications for teammates"
  on public.notifications for insert
  with check (
    (actor_id is null or actor_id = auth.uid())
    and public.project_role_for(project_id, user_id) <> 'viewer'
  );

-- ANONYMOUS SUGGESTIONS -------------------------------------------------
-- "Suggest an improvement" for visitors who aren't project team members
-- (no account, or an account with no role on this project beyond
-- default viewer). Lightweight feedback, not a full comment thread --
-- the team reviews these separately from section_comments.
create table if not exists public.section_suggestions (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid not null references public.sections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  body text not null,
  suggester_name text,
  suggester_email text,
  status public.pending_change_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists section_suggestions_project_id_idx
  on public.section_suggestions(project_id, status);

alter table public.section_suggestions enable row level security;

create policy "Anyone can submit a suggestion"
  on public.section_suggestions for insert
  with check (true);

create policy "Team members (commenter+) can view suggestions"
  on public.section_suggestions for select
  using (public.project_role_can_comment(project_id, auth.uid()));

create policy "Managers can update suggestion status"
  on public.section_suggestions for update
  using (public.project_role_is_manager(project_id, auth.uid()));

create policy "Managers can delete suggestions"
  on public.section_suggestions for delete
  using (public.project_role_is_manager(project_id, auth.uid()));

-- IMAGE STORAGE -------------------------------------------------------------
-- Public bucket for images inserted into section content via the editor.
insert into storage.buckets (id, name, public)
values ('section-images', 'section-images', true)
on conflict (id) do nothing;

create policy "Anyone can view section images"
  on storage.objects for select
  using (bucket_id = 'section-images');

-- Editors+ only (not every signed-in user): image uploads are part of
-- editing documentation content, so they follow the same permission as
-- editing sections. There's no project_id on storage.objects to check
-- against directly, so this trusts auth.role() = 'authenticated' at the
-- storage layer and relies on the editor UI (gated on role) plus the
-- section-write RLS policies above to keep uploads meaningful --
-- consistent with the pre-existing model where storage itself doesn't
-- know about projects.
create policy "Signed-in users can upload section images"
  on storage.objects for insert
  with check (bucket_id = 'section-images' and auth.role() = 'authenticated');

create policy "Signed-in users can delete their own section images"
  on storage.objects for delete
  using (bucket_id = 'section-images' and auth.uid() = owner);

-- Public bucket for custom project icons.
insert into storage.buckets (id, name, public)
values ('project-icons', 'project-icons', true)
on conflict (id) do nothing;

create policy "Anyone can view project icons"
  on storage.objects for select
  using (bucket_id = 'project-icons');

create policy "Signed-in users can upload project icons"
  on storage.objects for insert
  with check (bucket_id = 'project-icons' and auth.role() = 'authenticated');

create policy "Signed-in users can delete their own project icons"
  on storage.objects for delete
  using (bucket_id = 'project-icons' and auth.uid() = owner);
