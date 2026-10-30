-- P3-06: Denetim kaydı — audit_events + satır değişikliği trigger'ları

create table if not exists public.audit_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_workspace_created_idx
  on public.audit_events (workspace_id, created_at desc);

comment on table public.audit_events is 'Çalışma alanı denetim günlüğü; yalnızca trigger yazar.';

alter table public.audit_events enable row level security;

drop policy if exists "Workspace admins can read audit events" on public.audit_events;
create policy "Workspace admins can read audit events"
  on public.audit_events
  for select
  using (public.is_workspace_admin(workspace_id));

grant select on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  ent_id uuid;
  diff jsonb := null;
  skip_cols text[] := array['created_at', 'updated_at'];
  sensitive_cols text[] := array[
    'api_key',
    'access_token',
    'refresh_token',
    'token_hash',
    'token_expires_at'
  ];
  old_j jsonb;
  new_j jsonb;
begin
  if tg_table_name = 'workspace_members' then
    ws_id := coalesce(new.workspace_id, old.workspace_id);
    ent_id := coalesce(new.user_id, old.user_id);
  else
    ws_id := coalesce(new.user_id, old.user_id);
    ent_id := coalesce(new.id, old.id);
  end if;

  if ws_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new_j := to_jsonb(new);
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into diff
      from jsonb_each(new_j)
     where key <> all (skip_cols)
       and key <> all (sensitive_cols);

    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id, diff)
    values (ws_id, auth.uid(), 'insert', tg_table_name, ent_id, diff);
    return new;

  elsif tg_op = 'UPDATE' then
    old_j := to_jsonb(old);
    new_j := to_jsonb(new);
    select coalesce(
      jsonb_object_agg(
        n.key,
        jsonb_build_object('old', old_j -> n.key, 'new', n.value)
      ),
      '{}'::jsonb
    )
      into diff
      from jsonb_each(new_j) n
     where (old_j -> n.key) is distinct from n.value
       and n.key <> all (skip_cols)
       and n.key <> all (sensitive_cols);

    if diff = '{}'::jsonb then
      return new;
    end if;

    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id, diff)
    values (ws_id, auth.uid(), 'update', tg_table_name, ent_id, diff);
    return new;

  elsif tg_op = 'DELETE' then
    old_j := to_jsonb(old);
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into diff
      from jsonb_each(old_j)
     where key <> all (skip_cols)
       and key <> all (sensitive_cols);

    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id, diff)
    values (ws_id, auth.uid(), 'delete', tg_table_name, ent_id, diff);
    return old;
  end if;

  return null;
end;
$$;

comment on function public.audit_row_change() is 'Denetlenen tablolardaki DML → audit_events (hassas kolonlar hariç).';

-- Trigger'lar
drop trigger if exists audit_row_change on public.jobs;
create trigger audit_row_change
  after insert or update or delete on public.jobs
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.machines;
create trigger audit_row_change
  after insert or update or delete on public.machines
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.materials;
create trigger audit_row_change
  after insert or update or delete on public.materials
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.material_colors;
create trigger audit_row_change
  after insert or update or delete on public.material_colors
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.customers;
create trigger audit_row_change
  after insert or update or delete on public.customers
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.faults;
create trigger audit_row_change
  after insert or update or delete on public.faults
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.material_purchases;
create trigger audit_row_change
  after insert or update or delete on public.material_purchases
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.catalog_items;
create trigger audit_row_change
  after insert or update or delete on public.catalog_items
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.workspace_members;
create trigger audit_row_change
  after insert or update or delete on public.workspace_members
  for each row execute function public.audit_row_change();
