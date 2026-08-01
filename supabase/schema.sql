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

create index if not exists sections_project_id_idx on public.sections(project_id);
create index if not exists sections_position_idx on public.sections(project_id, position);

alter table public.sections enable row level security;

create policy "Anyone can view sections"
  on public.sections for select
  using (true);

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

-- IMAGE STORAGE -------------------------------------------------------------
-- Public bucket for images inserted into section content via the editor.
insert into storage.buckets (id, name, public)
values ('section-images', 'section-images', true)
on conflict (id) do nothing;

create policy "Anyone can view section images"
  on storage.objects for select
  using (bucket_id = 'section-images');

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
