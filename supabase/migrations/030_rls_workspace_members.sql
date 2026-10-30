-- P3-02: Kiracı RLS — auth.uid() = user_id → is_workspace_member(user_id)
-- Bağımlılık: 029_workspaces (is_workspace_member, workspace_members backfill)
--
-- Karar tablosu (istisnalar):
-- | Tablo / alan | Karar |
-- | client_error_events | Kişisel telemetri; politikalar auth.uid() ile kalır (üye paylaşımı yok). |
-- | billing_customers, subscriptions | user_id = çalışma alanı id; SELECT → is_workspace_member (03-ux §4). UI kısıtı P3-05. |
-- | support_reports, support_report_messages | SELECT/UPDATE → is_workspace_admin(user_id); INSERT talep → is_workspace_member(user_id). |
-- | profiles | user_id yok (id = kullanıcı); dokunulmadı. |
-- | billing_webhook_events | Kullanıcı politikası yok (service role). |
-- | bridge_pairing_codes | Kullanıcı politikası yok (service role API). |
--
-- Storage klasör adı = workspace id (eski user_id); job-files, catalog-files, support-attachments.

-- materials
drop policy if exists "Users can view own materials" on public.materials;
create policy "Users can view own materials" on public.materials for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own materials" on public.materials;
create policy "Users can insert own materials" on public.materials for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own materials" on public.materials;
create policy "Users can update own materials" on public.materials for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own materials" on public.materials;
create policy "Users can delete own materials" on public.materials for delete using (public.is_workspace_member(user_id));

-- machines
drop policy if exists "Users can view own machines" on public.machines;
create policy "Users can view own machines" on public.machines for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own machines" on public.machines;
create policy "Users can insert own machines" on public.machines for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own machines" on public.machines;
create policy "Users can update own machines" on public.machines for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own machines" on public.machines;
create policy "Users can delete own machines" on public.machines for delete using (public.is_workspace_member(user_id));

-- customers
drop policy if exists "Users can view own customers" on public.customers;
create policy "Users can view own customers" on public.customers for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own customers" on public.customers;
create policy "Users can insert own customers" on public.customers for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own customers" on public.customers;
create policy "Users can update own customers" on public.customers for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own customers" on public.customers;
create policy "Users can delete own customers" on public.customers for delete using (public.is_workspace_member(user_id));

-- jobs
drop policy if exists "Users can view own jobs" on public.jobs;
create policy "Users can view own jobs" on public.jobs for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own jobs" on public.jobs;
create policy "Users can insert own jobs" on public.jobs for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own jobs" on public.jobs;
create policy "Users can update own jobs" on public.jobs for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own jobs" on public.jobs;
create policy "Users can delete own jobs" on public.jobs for delete using (public.is_workspace_member(user_id));

-- material_colors
drop policy if exists "Users can view own material colors" on public.material_colors;
create policy "Users can view own material colors" on public.material_colors for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own material colors" on public.material_colors;
create policy "Users can insert own material colors" on public.material_colors for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own material colors" on public.material_colors;
create policy "Users can update own material colors" on public.material_colors for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own material colors" on public.material_colors;
create policy "Users can delete own material colors" on public.material_colors for delete using (public.is_workspace_member(user_id));

-- fault_types
drop policy if exists "Users can view own fault types" on public.fault_types;
create policy "Users can view own fault types" on public.fault_types for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own fault types" on public.fault_types;
create policy "Users can insert own fault types" on public.fault_types for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own fault types" on public.fault_types;
create policy "Users can update own fault types" on public.fault_types for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own fault types" on public.fault_types;
create policy "Users can delete own fault types" on public.fault_types for delete using (public.is_workspace_member(user_id));

-- faults
drop policy if exists "Users can view own faults" on public.faults;
create policy "Users can view own faults" on public.faults for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own faults" on public.faults;
create policy "Users can insert own faults" on public.faults for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own faults" on public.faults;
create policy "Users can update own faults" on public.faults for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own faults" on public.faults;
create policy "Users can delete own faults" on public.faults for delete using (public.is_workspace_member(user_id));

-- suppliers
drop policy if exists "Users can view own suppliers" on public.suppliers;
create policy "Users can view own suppliers" on public.suppliers for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own suppliers" on public.suppliers;
create policy "Users can insert own suppliers" on public.suppliers for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own suppliers" on public.suppliers;
create policy "Users can update own suppliers" on public.suppliers for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own suppliers" on public.suppliers;
create policy "Users can delete own suppliers" on public.suppliers for delete using (public.is_workspace_member(user_id));

-- material_purchases
drop policy if exists "Users can view own purchases" on public.material_purchases;
create policy "Users can view own purchases" on public.material_purchases for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own purchases" on public.material_purchases;
create policy "Users can insert own purchases" on public.material_purchases for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own purchases" on public.material_purchases;
create policy "Users can update own purchases" on public.material_purchases for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own purchases" on public.material_purchases;
create policy "Users can delete own purchases" on public.material_purchases for delete using (public.is_workspace_member(user_id));

-- catalog_items
drop policy if exists "Users can view own catalog items" on public.catalog_items;
create policy "Users can view own catalog items" on public.catalog_items for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog items" on public.catalog_items;
create policy "Users can insert own catalog items" on public.catalog_items for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own catalog items" on public.catalog_items;
create policy "Users can update own catalog items" on public.catalog_items for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own catalog items" on public.catalog_items;
create policy "Users can delete own catalog items" on public.catalog_items for delete using (public.is_workspace_member(user_id));

-- catalog_files
drop policy if exists "Users can view own catalog files" on public.catalog_files;
create policy "Users can view own catalog files" on public.catalog_files for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own catalog files" on public.catalog_files;
create policy "Users can delete own catalog files" on public.catalog_files for delete using (public.is_workspace_member(user_id));

-- catalog_item_jobs
drop policy if exists "Users can view own catalog item jobs" on public.catalog_item_jobs;
create policy "Users can view own catalog item jobs" on public.catalog_item_jobs for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own catalog item jobs" on public.catalog_item_jobs;
create policy "Users can delete own catalog item jobs" on public.catalog_item_jobs for delete using (public.is_workspace_member(user_id));

-- catalog_inventory
drop policy if exists "Users can view own catalog inventory" on public.catalog_inventory;
create policy "Users can view own catalog inventory" on public.catalog_inventory for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog inventory" on public.catalog_inventory;
create policy "Users can insert own catalog inventory" on public.catalog_inventory for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own catalog inventory" on public.catalog_inventory;
create policy "Users can update own catalog inventory" on public.catalog_inventory for update using (public.is_workspace_member(user_id));

-- sales
drop policy if exists "Users can view own sales" on public.sales;
create policy "Users can view own sales" on public.sales for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own sales" on public.sales;
create policy "Users can insert own sales" on public.sales for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own sales" on public.sales;
create policy "Users can delete own sales" on public.sales for delete using (public.is_workspace_member(user_id));

-- shipments
drop policy if exists "Users can view own shipments" on public.shipments;
create policy "Users can view own shipments" on public.shipments for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own shipments" on public.shipments;
create policy "Users can insert own shipments" on public.shipments for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own shipments" on public.shipments;
create policy "Users can update own shipments" on public.shipments for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own shipments" on public.shipments;
create policy "Users can delete own shipments" on public.shipments for delete using (public.is_workspace_member(user_id));

-- catalog_events
drop policy if exists "Users can view own catalog events" on public.catalog_events;
create policy "Users can view own catalog events" on public.catalog_events for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog events" on public.catalog_events;
create policy "Users can insert own catalog events" on public.catalog_events for insert with check (public.is_workspace_member(user_id));

-- machine_connections
drop policy if exists "Users can view own machine connections" on public.machine_connections;
create policy "Users can view own machine connections" on public.machine_connections for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own machine connections" on public.machine_connections;
create policy "Users can insert own machine connections" on public.machine_connections for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own machine connections" on public.machine_connections;
create policy "Users can update own machine connections" on public.machine_connections for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own machine connections" on public.machine_connections;
create policy "Users can delete own machine connections" on public.machine_connections for delete using (public.is_workspace_member(user_id));

-- printer_integration_accounts
drop policy if exists "Users can view own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can view own printer integration accounts" on public.printer_integration_accounts for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can insert own printer integration accounts" on public.printer_integration_accounts for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can update own printer integration accounts" on public.printer_integration_accounts for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can delete own printer integration accounts" on public.printer_integration_accounts for delete using (public.is_workspace_member(user_id));

-- machine_cloud_links
drop policy if exists "Users can view own machine cloud links" on public.machine_cloud_links;
create policy "Users can view own machine cloud links" on public.machine_cloud_links for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own machine cloud links" on public.machine_cloud_links;
create policy "Users can insert own machine cloud links" on public.machine_cloud_links for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own machine cloud links" on public.machine_cloud_links;
create policy "Users can update own machine cloud links" on public.machine_cloud_links for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own machine cloud links" on public.machine_cloud_links;
create policy "Users can delete own machine cloud links" on public.machine_cloud_links for delete using (public.is_workspace_member(user_id));

-- workshop_bridges
drop policy if exists "Users view own workshop bridges" on public.workshop_bridges;
create policy "Users view own workshop bridges" on public.workshop_bridges for select using (public.is_workspace_member(user_id));
drop policy if exists "Users delete own workshop bridges" on public.workshop_bridges;
create policy "Users delete own workshop bridges" on public.workshop_bridges for delete using (public.is_workspace_member(user_id));

-- bridge_machine_bindings
drop policy if exists "Users view own bridge bindings" on public.bridge_machine_bindings;
create policy "Users view own bridge bindings" on public.bridge_machine_bindings for select using (public.is_workspace_member(user_id));

-- machine_telemetry_snapshots
drop policy if exists "Users view own telemetry snapshots" on public.machine_telemetry_snapshots;
create policy "Users view own telemetry snapshots" on public.machine_telemetry_snapshots for select using (public.is_workspace_member(user_id));
drop policy if exists "Users insert own telemetry snapshots" on public.machine_telemetry_snapshots;
create policy "Users insert own telemetry snapshots" on public.machine_telemetry_snapshots for insert with check (public.is_workspace_member(user_id));

-- machine_camera_frames
drop policy if exists "Users view own machine camera frames" on public.machine_camera_frames;
create policy "Users view own machine camera frames" on public.machine_camera_frames for select using (public.is_workspace_member(user_id));

-- bridge_support_bundles
drop policy if exists "Users view own bridge support bundles" on public.bridge_support_bundles;
create policy "Users view own bridge support bundles" on public.bridge_support_bundles for select using (public.is_workspace_member(user_id));



-- catalog_files / catalog_item_jobs (insert politikaları)
drop policy if exists "Users can insert own catalog files" on public.catalog_files;
create policy "Users can insert own catalog files" on public.catalog_files
  for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog item jobs" on public.catalog_item_jobs;
create policy "Users can insert own catalog item jobs" on public.catalog_item_jobs
  for insert with check (public.is_workspace_member(user_id));

-- job_notes / job_files (jobs.user_id = workspace id)
drop policy if exists "Users can view own job notes" on public.job_notes;
create policy "Users can view own job notes" on public.job_notes for select
  using (exists (
    select 1 from public.jobs j
    where j.id = job_notes.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can insert own job notes" on public.job_notes;
create policy "Users can insert own job notes" on public.job_notes for insert
  with check (exists (
    select 1 from public.jobs j
    where j.id = job_notes.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can delete own job notes" on public.job_notes;
create policy "Users can delete own job notes" on public.job_notes for delete
  using (exists (
    select 1 from public.jobs j
    where j.id = job_notes.job_id and public.is_workspace_member(j.user_id)
  ));

drop policy if exists "Users can view own job files" on public.job_files;
create policy "Users can view own job files" on public.job_files for select
  using (exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can insert own job files" on public.job_files;
create policy "Users can insert own job files" on public.job_files for insert
  with check (exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can delete own job files" on public.job_files;
create policy "Users can delete own job files" on public.job_files for delete
  using (exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id and public.is_workspace_member(j.user_id)
  ));

-- billing (salt okunur)
drop policy if exists "Users can view own billing customer" on public.billing_customers;
create policy "Users can view own billing customer" on public.billing_customers
  for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription" on public.subscriptions
  for select using (public.is_workspace_member(user_id));

-- destek
drop policy if exists "Users view own support reports" on public.support_reports;
create policy "Users view own support reports" on public.support_reports
  for select using (public.is_workspace_admin(user_id));
drop policy if exists "Users insert own support reports" on public.support_reports;
create policy "Users insert own support reports" on public.support_reports
  for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users update own support reports" on public.support_reports;
create policy "Users update own support reports" on public.support_reports
  for update using (public.is_workspace_admin(user_id));

drop policy if exists "Users view messages on own reports" on public.support_report_messages;
create policy "Users view messages on own reports" on public.support_report_messages
  for select using (exists (
    select 1 from public.support_reports r
    where r.id = report_id and public.is_workspace_admin(r.user_id)
  ));
drop policy if exists "Users insert customer messages on own reports" on public.support_report_messages;
create policy "Users insert customer messages on own reports" on public.support_report_messages
  for insert with check (
    author_type = 'customer'
    and author_user_id = auth.uid()
    and exists (
      select 1 from public.support_reports r
      where r.id = report_id and public.is_workspace_member(r.user_id)
    )
  );

-- storage (workspace klasörü)
drop policy if exists "Users can upload own job files" on storage.objects;
create policy "Users can upload own job files" on storage.objects for insert
  with check (
    bucket_id = 'job-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can view own job files storage" on storage.objects;
create policy "Users can view own job files storage" on storage.objects for select
  using (
    bucket_id = 'job-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can delete own job files storage" on storage.objects;
create policy "Users can delete own job files storage" on storage.objects for delete
  using (
    bucket_id = 'job-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Users can upload own catalog files" on storage.objects;
create policy "Users can upload own catalog files" on storage.objects for insert
  with check (
    bucket_id = 'catalog-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can view own catalog files storage" on storage.objects;
create policy "Users can view own catalog files storage" on storage.objects for select
  using (
    bucket_id = 'catalog-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can delete own catalog files storage" on storage.objects;
create policy "Users can delete own catalog files storage" on storage.objects for delete
  using (
    bucket_id = 'catalog-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Users upload own support attachments" on storage.objects;
create policy "Users upload own support attachments" on storage.objects for insert
  with check (
    bucket_id = 'support-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users read own support attachments" on storage.objects;
create policy "Users read own support attachments" on storage.objects for select
  using (
    bucket_id = 'support-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users delete own support attachments" on storage.objects;
create policy "Users delete own support attachments" on storage.objects for delete
  using (
    bucket_id = 'support-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
