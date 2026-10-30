-- P3-07: Bildirim merkezi — notifications, tercihler, üretim trigger'ları

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (
    kind in ('machine', 'order', 'stock', 'payment', 'team', 'system')
  ),
  title text not null,
  body text,
  href text,
  seen_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_workspace_created_idx
  on public.notifications (user_id, workspace_id, created_at desc);

create index if not exists notifications_user_unseen_idx
  on public.notifications (user_id, workspace_id)
  where seen_at is null;

comment on table public.notifications is 'Kullanıcı bildirimleri (çalışma alanı kapsamlı).';

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (
    kind in ('machine', 'order', 'stock', 'payment', 'team', 'system')
  ),
  in_app boolean not null default true,
  email boolean not null default false,
  primary key (user_id, kind)
);

comment on table public.notification_preferences is 'Bildirim kanal tercihleri (kullanıcı × tür).';

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications
  for select
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications
  for update
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  )
  with check (user_id = auth.uid());

drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences"
  on public.notification_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

create or replace function public.notification_pref_enabled(
  p_user_id uuid,
  p_kind text,
  p_channel text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pref record;
  default_in_app boolean := true;
  default_email boolean := false;
begin
  if p_kind in ('payment', 'team') then
    default_email := true;
  end if;

  select in_app, email
    into pref
    from public.notification_preferences np
   where np.user_id = p_user_id
     and np.kind = p_kind;

  if not found then
    if p_channel = 'in_app' then
      return default_in_app;
    elsif p_channel = 'email' then
      return default_email;
    end if;
    return false;
  end if;

  if p_channel = 'in_app' then
    return coalesce(pref.in_app, default_in_app);
  elsif p_channel = 'email' then
    return coalesce(pref.email, default_email);
  end if;

  return false;
end;
$$;

create or replace function public.notify_workspace_members(
  p_workspace_id uuid,
  p_kind text,
  p_title text,
  p_body text default null,
  p_href text default null,
  p_exclude_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
  dedupe_since timestamptz := now() - interval '6 hours';
begin
  for member in
    select wm.user_id
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and (p_exclude_user_id is null or wm.user_id <> p_exclude_user_id)
  loop
    if not public.notification_pref_enabled(member.user_id, p_kind, 'in_app') then
      continue;
    end if;

    if p_href is not null and exists (
      select 1
      from public.notifications n
      where n.user_id = member.user_id
        and n.workspace_id = p_workspace_id
        and n.kind = p_kind
        and n.href = p_href
        and n.created_at >= dedupe_since
    ) then
      continue;
    end if;

    insert into public.notifications (
      workspace_id,
      user_id,
      kind,
      title,
      body,
      href
    ) values (
      p_workspace_id,
      member.user_id,
      p_kind,
      p_title,
      p_body,
      p_href
    );
  end loop;
end;
$$;

-- Makine hata durumu
create or replace function public.notify_machine_error()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(old.printer_state, '') <> 'error'
     and new.printer_state = 'error' then
    perform public.notify_workspace_members(
      new.user_id,
      'machine',
      format('Makine hatası: %s', coalesce(new.name, 'Makine')),
      coalesce(new.error_message, 'Yazıcı hata durumuna geçti.'),
      format('/machines/%s', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_machine_error on public.machines;
create trigger notify_machine_error
  after update of printer_state on public.machines
  for each row
  execute function public.notify_machine_error();

-- Düşük stok
create or replace function public.material_color_low_stock_threshold(p_row public.material_colors)
returns integer
language sql
stable
as $$
  select coalesce(p_row.low_stock_grams, 500);
$$;

create or replace function public.notify_material_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold integer;
  was_low boolean;
  is_low boolean;
  mat_name text;
begin
  threshold := public.material_color_low_stock_threshold(new);
  was_low := coalesce(old.stock_grams, 0) < threshold;
  is_low := coalesce(new.stock_grams, 0) < threshold;

  if not is_low or was_low then
    return new;
  end if;

  select m.name into mat_name
  from public.materials m
  where m.id = new.material_id;

  perform public.notify_workspace_members(
    new.user_id,
    'stock',
    format('Düşük stok: %s — %s', coalesce(mat_name, 'Malzeme'), coalesce(new.color_name, 'Renk')),
    format('Stok %s g (eşik %s g).', coalesce(new.stock_grams, 0), threshold),
    '/materials'
  );

  return new;
end;
$$;

drop trigger if exists notify_material_low_stock on public.material_colors;
create trigger notify_material_low_stock
  after update of stock_grams, low_stock_grams on public.material_colors
  for each row
  execute function public.notify_material_low_stock();

-- Davet kabulü (ekip bildirimi)
create or replace function public.notify_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepter_email text;
begin
  if tg_op = 'UPDATE'
     and old.accepted_at is null
     and new.accepted_at is not null then
    select p.email into accepter_email
    from public.profiles p
    where lower(p.email) = lower(new.email::text)
    limit 1;

    perform public.notify_workspace_members(
      new.workspace_id,
      'team',
      'Davet kabul edildi',
      format('%s çalışma alanına %s rolüyle katıldı.', coalesce(accepter_email, new.email::text), new.role),
      '/settings/team'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_invite_accepted on public.workspace_invites;
create trigger notify_invite_accepted
  after update of accepted_at on public.workspace_invites
  for each row
  execute function public.notify_invite_accepted();
