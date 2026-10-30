drop trigger if exists audit_row_change on public.workspace_members;
drop trigger if exists audit_row_change on public.catalog_items;
drop trigger if exists audit_row_change on public.material_purchases;
drop trigger if exists audit_row_change on public.faults;
drop trigger if exists audit_row_change on public.customers;
drop trigger if exists audit_row_change on public.material_colors;
drop trigger if exists audit_row_change on public.materials;
drop trigger if exists audit_row_change on public.machines;
drop trigger if exists audit_row_change on public.jobs;

drop function if exists public.audit_row_change();

drop policy if exists "Workspace admins can read audit events" on public.audit_events;

drop table if exists public.audit_events;
