-- P3-01: çalışma alanı veri modeli (workspaces, üyeler, davetler)

create extension if not exists citext with schema public;

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  ui_version text check (ui_version in ('v1', 'v2'))
);

comment on table public.workspaces is
  'Kiracı çalışma alanı; sahip kullanıcının id''si ile aynı uuid (P3-01 backfill).';

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'accountant', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user on public.workspace_members (user_id);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email citext not null,
  role text not null check (role in ('owner', 'admin', 'operator', 'accountant', 'viewer')),
  token_hash text not null,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz
);

create index if not exists idx_workspace_invites_workspace on public.workspace_invites (workspace_id);
create index if not exists idx_workspace_invites_email on public.workspace_invites (email);

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar (P3-02 RLS geçişi için)
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = ws
    and wm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.workspace_role(ws) in ('owner', 'admin'), false);
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated, anon;
grant execute on function public.workspace_role(uuid) to authenticated, anon;
grant execute on function public.is_workspace_admin(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Backfill: mevcut profiller → workspace + owner üyeliği
-- ---------------------------------------------------------------------------

insert into public.workspaces (id, name)
select
  p.id,
  coalesce(
    nullif(trim(p.company_name), ''),
    nullif(trim(p.full_name), ''),
    'Atölyem'
  )
from public.profiles p
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select p.id, p.id, 'owner'
from public.profiles p
on conflict (workspace_id, user_id) do nothing;

-- auth.users without profile row (edge case)
insert into public.workspaces (id, name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'company_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    'Atölyem'
  )
from auth.users u
where not exists (select 1 from public.workspaces w where w.id = u.id)
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select u.id, u.id, 'owner'
from auth.users u
where exists (select 1 from public.workspaces w where w.id = u.id)
  and not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = u.id
      and wm.user_id = u.id
  )
on conflict (workspace_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Yeni kayıt: profil + workspace + owner
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_name text;
begin
  ws_name := coalesce(
    nullif(trim(NEW.raw_user_meta_data->>'company_name'), ''),
    nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    'Atölyem'
  );

  insert into public.profiles (id, email, full_name, company_name)
  values (
    NEW.id,
    NEW.email,
    nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(NEW.raw_user_meta_data->>'company_name'), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_name = coalesce(excluded.company_name, public.profiles.company_name);

  insert into public.workspaces (id, name)
  values (NEW.id, ws_name)
  on conflict (id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (NEW.id, NEW.id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return NEW;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', NEW.email, SQLERRM;
    return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS (yalnızca yeni tablolar)
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

drop policy if exists "Workspace members can view workspace" on public.workspaces;
create policy "Workspace members can view workspace"
  on public.workspaces
  for select
  using (public.is_workspace_member(id));

drop policy if exists "Workspace admins can update workspace" on public.workspaces;
create policy "Workspace admins can update workspace"
  on public.workspaces
  for update
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

drop policy if exists "Workspace members can view members" on public.workspace_members;
create policy "Workspace members can view members"
  on public.workspace_members
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins can insert members" on public.workspace_members;
create policy "Workspace admins can insert members"
  on public.workspace_members
  for insert
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can update members" on public.workspace_members;
create policy "Workspace admins can update members"
  on public.workspace_members
  for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can delete members" on public.workspace_members;
create policy "Workspace admins can delete members"
  on public.workspace_members
  for delete
  using (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace members can view invites" on public.workspace_invites;
create policy "Workspace members can view invites"
  on public.workspace_invites
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins can insert invites" on public.workspace_invites;
create policy "Workspace admins can insert invites"
  on public.workspace_invites
  for insert
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can update invites" on public.workspace_invites;
create policy "Workspace admins can update invites"
  on public.workspace_invites
  for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can delete invites" on public.workspace_invites;
create policy "Workspace admins can delete invites"
  on public.workspace_invites
  for delete
  using (public.is_workspace_admin(workspace_id));
