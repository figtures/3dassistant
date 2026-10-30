drop trigger if exists notify_invite_accepted on public.workspace_invites;
drop trigger if exists notify_material_low_stock on public.material_colors;
drop trigger if exists notify_machine_error on public.machines;

drop function if exists public.notify_invite_accepted();
drop function if exists public.notify_material_low_stock();
drop function if exists public.material_color_low_stock_threshold(public.material_colors);
drop function if exists public.notify_machine_error();
drop function if exists public.notify_workspace_members(uuid, text, text, text, text, uuid);
drop function if exists public.notification_pref_enabled(uuid, text, text);

drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Users read own notifications" on public.notifications;

drop table if exists public.notification_preferences;
drop table if exists public.notifications;
