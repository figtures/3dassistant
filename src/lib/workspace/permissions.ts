import type { WorkspaceRole } from "@/types/database";

/** 03-ux-architecture §4.2 — çalışma alanı eylem anahtarları. */
export const WORKSPACE_ACTIONS = [
  "orders.view",
  "orders.edit",
  "finance.view",
  "finance.edit",
  "machines.view",
  "machines.manage",
  "faults.edit",
  "materials.view",
  "materials.stock",
  "materials.procurement",
  "customers.view",
  "customers.edit",
  "export.data",
  "team.manage",
  "billing.view",
  "billing.manage",
  "audit.view",
  "workspace.edit",
  "workspace.delete",
  "settings.personal",
] as const;

export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

const ALL_ACTIONS = new Set<WorkspaceAction>(WORKSPACE_ACTIONS);

const ROLE_ACTIONS: Record<WorkspaceRole, ReadonlySet<WorkspaceAction>> = {
  owner: ALL_ACTIONS,
  admin: new Set(
    WORKSPACE_ACTIONS.filter(
      (a) =>
        a !== "billing.manage" &&
        a !== "billing.view" &&
        a !== "workspace.delete"
    )
  ),
  operator: new Set<WorkspaceAction>([
    "orders.view",
    "orders.edit",
    "machines.view",
    "faults.edit",
    "materials.view",
    "materials.stock",
    "customers.view",
    "customers.edit",
    "settings.personal",
  ]),
  accountant: new Set<WorkspaceAction>([
    "orders.view",
    "finance.view",
    "finance.edit",
    "materials.view",
    "materials.procurement",
    "customers.view",
    "export.data",
    "billing.view",
    "settings.personal",
  ]),
  viewer: new Set<WorkspaceAction>(["orders.view", "settings.personal"]),
};

export function can(
  role: WorkspaceRole | null | undefined,
  action: WorkspaceAction
): boolean {
  if (!role) return false;
  return ROLE_ACTIONS[role]?.has(action) ?? false;
}

export function canViewFinance(role: WorkspaceRole | null | undefined): boolean {
  return can(role, "finance.view");
}

/** Sidebar / ayarlar alt menüsü — `NavItem.action` ile eşleşir. */
export const NAV_ITEM_ACTION: Record<string, WorkspaceAction> = {
  dashboard: "orders.view",
  planning: "orders.edit",
  orders: "orders.view",
  calendar: "orders.view",
  machines: "machines.view",
  faults: "faults.edit",
  materials: "materials.view",
  procurement: "materials.procurement",
  catalog: "materials.view",
  customers: "customers.view",
  billing: "billing.view",
  changelog: "orders.view",
  support: "orders.view",
  settings: "settings.personal",
  "settings-profile": "settings.personal",
  "settings-workspace": "settings.personal",
  "settings-team": "orders.view",
  "settings-notifications": "settings.personal",
  "settings-integrations": "workspace.edit",
  "settings-billing": "billing.view",
  "settings-audit": "audit.view",
  "settings-appearance": "settings.personal",
};

export type NavVisibilityContext = {
  role: WorkspaceRole;
  /** Destek yönetimi (`SUPPORT_ADMIN_EMAILS`) */
  isSupportAdmin?: boolean;
};

export function isNavItemVisible(
  item: { id: string; adminOnly?: boolean },
  ctx: NavVisibilityContext
): boolean {
  if (item.adminOnly && !ctx.isSupportAdmin) return false;
  const action = NAV_ITEM_ACTION[item.id];
  if (!action) return true;
  return can(ctx.role, action);
}
