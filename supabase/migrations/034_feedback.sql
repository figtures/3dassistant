-- P3-14: NPS, CSAT ve sayfa içi geri bildirim yanıtları

create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('nps', 'csat', 'page')),
  score int not null,
  comment text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint feedback_responses_score_nps check (kind <> 'nps' or (score >= 0 and score <= 10)),
  constraint feedback_responses_score_csat check (kind <> 'csat' or (score >= 1 and score <= 5)),
  constraint feedback_responses_score_page check (kind <> 'page' or (score >= 1 and score <= 5))
);

create index if not exists feedback_responses_user_kind_created_idx
  on public.feedback_responses (user_id, kind, created_at desc);

create index if not exists feedback_responses_workspace_kind_created_idx
  on public.feedback_responses (workspace_id, kind, created_at desc);

comment on table public.feedback_responses is 'NPS, CSAT ve sayfa içi geri bildirim kayıtları (P3-14).';

alter table public.feedback_responses enable row level security;

drop policy if exists "Users insert own feedback" on public.feedback_responses;
create policy "Users insert own feedback"
  on public.feedback_responses
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users read own feedback" on public.feedback_responses;
create policy "Users read own feedback"
  on public.feedback_responses
  for select
  using (user_id = auth.uid());

grant select, insert on public.feedback_responses to authenticated;
