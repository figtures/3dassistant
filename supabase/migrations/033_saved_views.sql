-- P3-08: Kayıtlı tablo görünümleri (filtre / sıralama / URL durumu)

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  table_id text not null,
  name text not null,
  state jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  constraint saved_views_name_len check (char_length(trim(name)) between 1 and 120)
);

create index if not exists saved_views_workspace_table_idx
  on public.saved_views (workspace_id, table_id, created_at desc);

create index if not exists saved_views_owner_table_idx
  on public.saved_views (user_id, workspace_id, table_id);

comment on table public.saved_views is 'DataTable URL durumu — kişisel veya paylaşılan görünümler.';

alter table public.saved_views enable row level security;

drop policy if exists "Members read saved views" on public.saved_views;
create policy "Members read saved views"
  on public.saved_views
  for select
  using (
    public.is_workspace_member(workspace_id)
    and (
      user_id = auth.uid()
      or shared = true
    )
  );

drop policy if exists "Members insert own saved views" on public.saved_views;
create policy "Members insert own saved views"
  on public.saved_views
  for insert
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "Owners update saved views" on public.saved_views;
create policy "Owners update saved views"
  on public.saved_views
  for update
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "Owners delete saved views" on public.saved_views;
create policy "Owners delete saved views"
  on public.saved_views
  for delete
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

grant select, insert, update, delete on public.saved_views to authenticated;
