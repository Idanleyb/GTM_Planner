-- GTM Planner — initial schema (Step 3)
--
-- Model: users belong to workspaces (owner / editor / viewer). A workspace holds
-- GTM projects. Each project's full plan lives in `projects.data` (jsonb, the
-- engine's ProjectData v2), validated in the app. A few columns are lifted out of
-- the jsonb for listing and sorting. `version` gives optimistic concurrency:
-- the app updates "where id = ? and version = ?" and treats 0 rows as a conflict.
--
-- Safe to run once on a fresh project (SQL editor or `supabase db push`).

-- ------------------------------------------------------------------ tables

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('owner', 'editor', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null check (email = lower(email)),
  role         text not null check (role in ('editor', 'viewer')),
  invited_by   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  unique (workspace_id, email)
);

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 200),
  motion         text not null default 'Hybrid'
                 check (motion in ('Sales-led', 'Marketing-led', 'PLG', 'Partner-led', 'Hybrid')),
  launch_date    date,
  schema_version int  not null default 2,
  data           jsonb not null check (jsonb_typeof(data) = 'object'),
  version        int  not null default 1,
  created_by     uuid not null references auth.users (id) default auth.uid(),
  updated_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);
create index projects_workspace_idx on public.projects (workspace_id, updated_at desc);

create table public.project_activity (
  id         bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) default auth.uid(),
  action     text not null check (char_length(action) between 1 and 60),
  summary    text,
  diff       jsonb,
  created_at timestamptz not null default now()
);
create index project_activity_project_idx on public.project_activity (project_id, created_at desc);

-- ------------------------------------------------------------------ helpers
-- SECURITY DEFINER so policies can check membership without recursing into
-- workspace_members' own RLS.

create or replace function public.workspace_role(ws uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.workspace_members where workspace_id = ws and user_id = auth.uid()
$$;

create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.workspace_role(ws) is not null $$;

create or replace function public.can_edit(ws uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.workspace_role(ws) in ('owner', 'editor') $$;

create or replace function public.is_owner(ws uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.workspace_role(ws) = 'owner' $$;

-- ------------------------------------------------------------------ triggers

-- New user → profile + personal workspace (as owner) + accept pending invites.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare ws uuid;
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email));
  insert into public.workspaces (name, created_by) values ('My workspace', new.id) returning id into ws;
  -- (on_workspace_created already adds the owner row; kept explicit and idempotent)
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner')
    on conflict do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
    select i.workspace_id, new.id, i.role from public.workspace_invites i
    where i.email = lower(new.email) and i.accepted_at is null
    on conflict do nothing;
  update public.workspace_invites set accepted_at = now()
    where email = lower(new.email) and accepted_at is null;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Workspace created by a signed-in user → creator becomes owner.
create or replace function public.handle_new_workspace()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  return new;
end $$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Project update → bump version, stamp updated_at / updated_by.
-- Ownership columns cannot be changed through updates.
create or replace function public.touch_project()
returns trigger language plpgsql
as $$
begin
  new.version      := old.version + 1;
  new.updated_at   := now();
  new.updated_by   := auth.uid();
  new.id           := old.id;
  new.workspace_id := old.workspace_id;
  new.created_by   := old.created_by;
  new.created_at   := old.created_at;
  return new;
end $$;

create trigger on_project_update
  before update on public.projects
  for each row execute function public.touch_project();

-- Keep at least one owner in every workspace.
create or replace function public.protect_last_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.workspaces w where w.id = old.workspace_id)
     and not exists (
       select 1 from public.workspace_members
       where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id
     ) then
    raise exception 'A workspace must keep at least one owner';
  end if;
  return coalesce(new, old);
end $$;

create trigger on_member_change
  before update or delete on public.workspace_members
  for each row execute function public.protect_last_owner();

-- ------------------------------------------------------------------ RLS

alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.projects          enable row level security;
alter table public.project_activity  enable row level security;

-- Anonymous visitors get nothing.
revoke all on public.profiles, public.workspaces, public.workspace_members,
              public.workspace_invites, public.projects, public.project_activity from anon;

-- profiles: see yourself and people you share a workspace with; edit yourself.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.workspace_members m
    where m.user_id = profiles.id and public.is_member(m.workspace_id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (created_by = auth.uid());
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (public.is_owner(id));

-- members: members can see the roster; only owners change it; anyone may leave.
create policy members_select on public.workspace_members for select to authenticated
  using (public.is_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated
  with check (public.is_owner(workspace_id));
create policy members_update on public.workspace_members for update to authenticated
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy members_delete on public.workspace_members for delete to authenticated
  using (public.is_owner(workspace_id) or user_id = auth.uid());

-- invites: owners manage; the invited person can see their own invite.
create policy invites_select on public.workspace_invites for select to authenticated
  using (public.is_owner(workspace_id) or email = lower(auth.jwt() ->> 'email'));
create policy invites_insert on public.workspace_invites for insert to authenticated
  with check (public.is_owner(workspace_id) and invited_by = auth.uid());
create policy invites_delete on public.workspace_invites for delete to authenticated
  using (public.is_owner(workspace_id));

-- projects: members read; owners/editors write; owners delete.
create policy projects_select on public.projects for select to authenticated
  using (public.is_member(workspace_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.can_edit(workspace_id) and created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_owner(workspace_id));

-- activity: members read; editors append as themselves; never edited or deleted.
create policy activity_select on public.project_activity for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id)));
create policy activity_insert on public.project_activity for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.projects p where p.id = project_id and public.can_edit(p.workspace_id)));
