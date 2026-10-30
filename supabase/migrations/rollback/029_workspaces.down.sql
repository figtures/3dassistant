-- P3-01 rollback: workspace tabloları ve yardımcılar

drop policy if exists "Workspace admins can delete invites" on public.workspace_invites;
drop policy if exists "Workspace admins can update invites" on public.workspace_invites;
drop policy if exists "Workspace admins can insert invites" on public.workspace_invites;
drop policy if exists "Workspace members can view invites" on public.workspace_invites;

drop policy if exists "Workspace admins can delete members" on public.workspace_members;
drop policy if exists "Workspace admins can update members" on public.workspace_members;
drop policy if exists "Workspace admins can insert members" on public.workspace_members;
drop policy if exists "Workspace members can view members" on public.workspace_members;

drop policy if exists "Workspace admins can update workspace" on public.workspaces;
drop policy if exists "Workspace members can view workspace" on public.workspaces;

drop table if exists public.workspace_invites;
drop table if exists public.workspace_members;
drop table if exists public.workspaces;

drop function if exists public.is_workspace_admin(uuid);
drop function if exists public.workspace_role(uuid);
drop function if exists public.is_workspace_member(uuid);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  return NEW;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', NEW.email, SQLERRM;
    return NEW;
end;
$$;
