drop policy if exists "Owners delete saved views" on public.saved_views;
drop policy if exists "Owners update saved views" on public.saved_views;
drop policy if exists "Members insert own saved views" on public.saved_views;
drop policy if exists "Members read saved views" on public.saved_views;

drop table if exists public.saved_views;
