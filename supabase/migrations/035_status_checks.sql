-- P3-16: Durum sayfası (/status) servis kontrolleri

create table if not exists public.status_checks (
  id bigint generated always as identity primary key,
  service text not null check (service in ('app', 'cloud_sync', 'bridge', 'email')),
  ok boolean not null,
  latency_ms int,
  checked_at timestamptz not null default now()
);

create index if not exists status_checks_service_checked_at_idx
  on public.status_checks (service, checked_at desc);

comment on table public.status_checks is 'Cron ve sağlık probelerinin servis durumu kayıtları (P3-16).';

alter table public.status_checks enable row level security;

drop policy if exists "Anyone can read status checks" on public.status_checks;
create policy "Anyone can read status checks"
  on public.status_checks
  for select
  using (true);

grant select on public.status_checks to anon, authenticated;
