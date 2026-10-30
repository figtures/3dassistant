export type JobStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type MachineStatus = "active" | "maintenance" | "offline";
export type MachineConnectionStatus = "connected" | "disconnected" | "error" | "never";
export type MachinePrinterState =
  | "printing"
  | "paused"
  | "idle"
  | "error"
  | "offline"
  | "unknown";
export type MachineAdapterType = "octoprint" | "moonraker" | "manual";
export type PrinterVendor = "bambu" | "prusa" | "creality";
export type IntegrationAccountStatus = "active" | "error" | "disconnected";
export type FileType = "stl" | "image" | "other";
export type CatalogFileType = "stl" | "3mf" | "image" | "zip" | "other";
export type ShipmentStatus = "pending" | "shipped" | "in_transit" | "delivered" | "returned";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "upcoming";
export type FaultStatus = "open" | "in_progress" | "resolved";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkspaceUiVersion = "v1" | "v2";

export const WORKSPACE_ROLES = [
  "owner",
  "admin",
  "operator",
  "accountant",
  "viewer",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  ui_version: WorkspaceUiVersion | null;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  workspace?: Workspace;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token_hash: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
}

export interface MaterialColor {
  id: string;
  material_id: string;
  user_id: string;
  color_name: string;
  hex_code: string | null;
  stock_grams: number;
  /** null = varsayılan 500 g (P2-06) */
  low_stock_grams?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  /** @deprecated material_colors kullanın */
  color: string | null;
  price_per_kg: number;
  /** @deprecated renk bazlı stok material_colors içinde */
  stock_grams: number;
  created_at: string;
  updated_at: string;
  material_colors?: MaterialColor[];
}

export interface MachineConnectionPublic {
  id: string;
  machine_id: string;
  adapter_type: MachineAdapterType;
  base_url: string | null;
  enabled: boolean;
  last_test_ok: boolean | null;
  last_test_at: string | null;
}

export interface PrinterIntegrationAccountPublic {
  id: string;
  vendor: PrinterVendor;
  display_name: string;
  status: IntegrationAccountStatus;
  last_sync_at: string | null;
}

export interface MachineCloudLinkPublic {
  id: string;
  machine_id: string;
  external_device_id: string;
  external_device_name: string | null;
  enabled: boolean;
  integration_account?: PrinterIntegrationAccountPublic | null;
}

export interface WorkshopBridgePublic {
  id: string;
  label: string;
  last_seen_at: string | null;
}

export interface BridgeMachineBindingPublic {
  id: string;
  machine_id: string;
  vendor?: string | null;
  device_serial: string;
  lan_host: string | null;
  device_label: string | null;
  last_push_at: string | null;
  bridge?: WorkshopBridgePublic | null;
}

export interface Machine {
  id: string;
  user_id: string;
  name: string;
  model: string | null;
  status: MachineStatus;
  sort_order: number;
  last_seen_at: string | null;
  connection_status: MachineConnectionStatus;
  printer_state: MachinePrinterState;
  job_name: string | null;
  progress_percent: number | null;
  print_time_seconds: number | null;
  error_message: string | null;
  bed_temp_c: number | null;
  nozzle_temp_c: number | null;
  chamber_temp_c: number | null;
  camera_stream_url: string | null;
  telemetry_updated_at: string | null;
  created_at: string;
  updated_at: string;
  machine_connection?: MachineConnectionPublic | null;
  machine_cloud_link?: MachineCloudLinkPublic | null;
  bridge_binding?: BridgeMachineBindingPublic | null;
}

export const CUSTOMER_SOURCES = [
  "Instagram",
  "Facebook",
  "Google",
  "Tavsiye",
  "Fuar",
  "Web sitesi",
  "Diğer",
] as const;

export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  source: string | null;
  referral: string | null;
  referred_by_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  machine_id: string;
  customer_id: string | null;
  material_id: string | null;
  material_color_id: string | null;
  job_date: string;
  delivery_date: string | null;
  title: string | null;
  description: string | null;
  grams_used: number | null;
  revenue_amount: number | null;
  duration_minutes: number | null;
  payment_status: PaymentStatus;
  amount_paid: number | null;
  amount_remaining: number | null;
  payment_due_date: string | null;
  installment_count: number | null;
  installment_amount: number | null;
  status: JobStatus;
  cell_color: string;
  last_overdue_reminder_at: string | null;
  stock_deducted?: boolean;
  created_at: string;
  updated_at: string;
  machine?: Machine;
  customer?: Customer;
  material?: Material;
  material_color?: MaterialColor;
  job_notes?: JobNote[];
  job_files?: JobFile[];
}

export interface JobNote {
  id: string;
  job_id: string;
  content: string;
  is_voice: boolean;
  parsed_data: ParsedNoteData | null;
  created_at: string;
}

export interface JobFile {
  id: string;
  job_id: string;
  file_name: string;
  file_path: string;
  file_type: FileType;
  file_size: number | null;
  created_at: string;
}

export interface ParsedNoteData {
  material?: string;
  color?: string;
  grams?: number;
  revenue?: number;
  customer?: string;
  status?: JobStatus;
  title?: string;
  deliveryDate?: string;
  durationMinutes?: number;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  amountRemaining?: number;
  paymentDueDate?: string;
  installmentCount?: number;
  installmentAmount?: number;
  customerSource?: string;
  referral?: string;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialPurchase {
  id: string;
  user_id: string;
  supplier_id: string | null;
  material_id: string;
  material_color_id: string | null;
  grams: number;
  unit_price: number;
  total: number;
  purchase_date: string;
  channel: string | null;
  order_url: string | null;
  invoice_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  material?: Material;
  material_color?: MaterialColor;
}

export interface CatalogItem {
  id: string;
  user_id: string;
  sku: string;
  name: string;
  description: string | null;
  default_material_id: string | null;
  default_grams: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  default_material?: Material;
  catalog_files?: CatalogFile[];
  catalog_inventory?: CatalogInventory | null;
}

export interface CatalogFile {
  id: string;
  user_id: string;
  item_id: string;
  file_type: CatalogFileType;
  path: string;
  original_name: string;
  file_size: number | null;
  checksum: string | null;
  version: number;
  created_at: string;
}

export interface CatalogInventory {
  id: string;
  user_id: string;
  item_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  updated_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  item_id: string;
  customer_id: string | null;
  channel: string | null;
  platform: string | null;
  unit_price: number;
  quantity: number;
  sold_at: string;
  notes: string | null;
  created_at: string;
  customer?: Customer;
  catalog_item?: CatalogItem;
  shipments?: Shipment[];
}

export interface Shipment {
  id: string;
  user_id: string;
  sale_id: string;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  status: ShipmentStatus;
  created_at: string;
  updated_at: string;
}

export interface CatalogItemJob {
  id: string;
  user_id: string;
  catalog_item_id: string;
  job_id: string;
  created_at: string;
  job?: Job;
}

export interface CatalogEvent {
  id: string;
  user_id: string;
  item_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ParsedProcurementData {
  supplier?: string;
  material?: string;
  color?: string;
  grams?: number;
  unitPrice?: number;
  total?: number;
  purchaseDate?: string;
  channel?: string;
  invoiceRef?: string;
  notes?: string;
}

export interface ParsedCatalogData {
  sku?: string;
  name?: string;
  description?: string;
  material?: string;
  grams?: number;
  tags?: string[];
}

export interface ParsedSaleData {
  itemName?: string;
  sku?: string;
  customer?: string;
  channel?: string;
  platform?: string;
  unitPrice?: number;
  quantity?: number;
  carrier?: string;
  trackingNumber?: string;
}

export interface ParsedFaultData {
  machine?: string;
  faultType?: string;
  durationHours?: number;
  description?: string;
  faultDate?: string;
  status?: FaultStatus;
}

export interface FaultType {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Fault {
  id: string;
  user_id: string;
  machine_id: string;
  fault_type_id: string | null;
  fault_type_name: string | null;
  duration_hours: number;
  description: string | null;
  fault_date: string;
  status: FaultStatus;
  created_at: string;
  updated_at: string;
  machine?: Machine;
  fault_type?: FaultType;
}

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  dateField?: "job_date" | "delivery_date";
  machineIds: string[];
  materialIds: string[];
  customerIds: string[];
  statuses: JobStatus[];
}

export interface DashboardMetrics {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  totalGramsUsed: number;
  totalRevenue: number;
  totalMaterialCost: number;
  netProfit: number;
  totalDurationMinutes: number;
  jobsByDate: { date: string; count: number }[];
  jobsByMachine: { name: string; count: number }[];
  jobsByMaterial: { name: string; grams: number }[];
  jobsByStatus: { status: string; count: number }[];
  gramsByDate: { date: string; grams: number }[];
  revenueByDate: { date: string; revenue: number }[];
  durationByDate: { date: string; minutes: number }[];
  jobsByPaymentStatus: { status: string; count: number }[];
  customersBySource: { source: string; count: number }[];
  faultDowntimeByMachine: { name: string; hours: number }[];
  procurementSpend: number;
  procurementSpendByDate: { date: string; amount: number }[];
  catalogItemCount: number;
  salesByChannel: { channel: string; count: number; revenue: number }[];
  lowStockCatalogItems: { sku: string; name: string; quantity: number }[];
}

export type AuditAction = "insert" | "update" | "delete";

export const NOTIFICATION_KINDS = [
  "machine",
  "order",
  "stock",
  "payment",
  "team",
  "system",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  seen_at: string | null;
  done_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  user_id: string;
  kind: NotificationKind;
  in_app: boolean;
  email: boolean;
}

export interface AuditEvent {
  id: number;
  workspace_id: string;
  actor_id: string | null;
  action: AuditAction;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
  actor?: Pick<Profile, "full_name" | "email"> | null;
}

/** DataTable URL anlık görüntüsü (kayıtlı görünüm). */
export type TableUrlSnapshot = Record<string, string>;

export interface SavedView {
  id: string;
  workspace_id: string;
  user_id: string;
  table_id: string;
  name: string;
  state: TableUrlSnapshot;
  shared: boolean;
  created_at: string;
}
