-- DOCLIX Supabase schema
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "uuid-ossp";

-- PROJECTS -------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
