import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Package,
  Palette,
  Plug,
  ScrollText,
  Settings,
  ShoppingCart,
  ShieldCheck,
  User,
  Users,
  Cpu,
} from "lucide-react";

export type NavSectionId = "overview" | "production" | "inventory" | "account";

export type NavBadgeKey = "machineErrors" | "overdueOrders" | "lowStock";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavSectionId;
  badgeKey?: NavBadgeKey;
  adminOnly?: boolean;
};

export const NAV_SECTION_LABELS: Record<NavSectionId, string> = {
  overview: "Genel",
  production: "Üretim",
  inventory: "Stok & satış",
  account: "Hesap",
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Genel Bakış",
    href: "/dashboard",
    icon: LayoutDashboard,
    section: "overview",
  },
  {
    id: "planning",
    label: "Planlama",
    href: "/planning",
    icon: CalendarDays,
    section: "production",
  },
  {
    id: "orders",
    label: "Siparişler",
    href: "/orders",
    icon: ClipboardList,
    section: "production",
    badgeKey: "overdueOrders",
  },
  {
    id: "calendar",
    label: "Teslim Takvimi",
    href: "/calendar",
    icon: Calendar,
    section: "production",
  },
  {
    id: "machines",
    label: "Makineler",
    href: "/machines",
    icon: Cpu,
    section: "production",
    badgeKey: "machineErrors",
  },
  {
    id: "faults",
    label: "Arızalar",
    href: "/faults",
    icon: AlertTriangle,
    section: "production",
  },
  {
    id: "materials",
    label: "Malzemeler",
    href: "/materials",
    icon: Package,
    section: "inventory",
    badgeKey: "lowStock",
  },
  {
    id: "procurement",
    label: "Tedarik",
    href: "/procurement",
    icon: ShoppingCart,
    section: "inventory",
  },
  {
    id: "catalog",
    label: "Katalog",
    href: "/catalog",
    icon: LayoutGrid,
    section: "inventory",
  },
  {
    id: "customers",
    label: "Müşteriler",
    href: "/customers",
    icon: Users,
    section: "inventory",
  },
  {
    id: "billing",
    label: "Abonelik",
    href: "/billing",
    icon: CreditCard,
    section: "account",
  },
  {
    id: "support",
    label: "Destek",
    href: "/support",
    icon: LifeBuoy,
    section: "account",
  },
  {
    id: "settings",
    label: "Ayarlar",
    href: "/settings",
    icon: Settings,
    section: "account",
  },
  {
    id: "support-admin",
    label: "Destek Yönetimi",
    href: "/support/admin",
    icon: ShieldCheck,
    section: "account",
    adminOnly: true,
  },
];

export const SETTINGS_NAV: NavItem[] = [
  {
    id: "settings-profile",
    label: "Profil",
    href: "/settings/profile",
    icon: User,
    section: "account",
  },
  {
    id: "settings-workspace",
    label: "Çalışma alanı",
    href: "/settings/workspace",
    icon: Building2,
    section: "account",
  },
  {
    id: "settings-team",
    label: "Ekip",
    href: "/settings/team",
    icon: Users,
    section: "account",
  },
  {
    id: "settings-notifications",
    label: "Bildirimler",
    href: "/settings/notifications",
    icon: Bell,
    section: "account",
  },
  {
    id: "settings-integrations",
    label: "Entegrasyonlar",
    href: "/settings/integrations",
    icon: Plug,
    section: "account",
  },
  {
    id: "settings-billing",
    label: "Abonelik ve fatura",
    href: "/settings/billing",
    icon: CreditCard,
    section: "account",
  },
  {
    id: "settings-audit",
    label: "Denetim kaydı",
    href: "/settings/audit",
    icon: ScrollText,
    section: "account",
    adminOnly: true,
  },
  {
    id: "settings-appearance",
    label: "Görünüm",
    href: "/settings/appearance",
    icon: Palette,
    section: "account",
  },
];

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Genel Bakış",
  planning: "Planlama",
  calendar: "Teslim Takvimi",
  machines: "Makineler",
  faults: "Arızalar",
  materials: "Malzemeler",
  procurement: "Tedarik",
  catalog: "Katalog",
  customers: "Müşteriler",
  billing: "Abonelik",
  support: "Destek",
  settings: "Ayarlar",
  profile: "Profil",
  workspace: "Çalışma alanı",
  team: "Ekip",
  notifications: "Bildirimler",
  integrations: "Entegrasyonlar",
  appearance: "Görünüm",
  audit: "Denetim kaydı",
  orders: "Siparişler",
};

export type BreadcrumbSegment = { label: string; href?: string };

export function getBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) {
    return [{ label: "Genel Bakış", href: "/dashboard" }];
  }

  const crumbs: BreadcrumbSegment[] = [];
  let path = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    path += `/${seg}`;
    const isLast = i === segments.length - 1;
    const label =
      ROUTE_LABELS[seg] ??
      (i > 0 ? "Detay" : seg.charAt(0).toUpperCase() + seg.slice(1));

    crumbs.push({
      label,
      href: isLast ? undefined : path,
    });
  }

  return crumbs;
}

/** v2: `useBreadcrumbLabel(segment, …)` ile gelen geçersiz kılma. */
export function applyBreadcrumbLabels(
  crumbs: BreadcrumbSegment[],
  pathname: string,
  labels: ReadonlyMap<string, string>
): BreadcrumbSegment[] {
  if (!labels.size) return crumbs;
  const segments = pathname.split("/").filter(Boolean);
  return crumbs.map((crumb, i) => {
    const seg = segments[i];
    const override = seg ? labels.get(seg) : undefined;
    return override ? { ...crumb, label: override } : crumb;
  });
}

export function groupNavItems(
  items: NavItem[],
  opts?: { isAdmin?: boolean }
): Array<{ section: NavSectionId; label: string; items: NavItem[] }> {
  const visible = items.filter(
    (item) => !item.adminOnly || opts?.isAdmin
  );
  const order: NavSectionId[] = [
    "overview",
    "production",
    "inventory",
    "account",
  ];

  return order
    .map((section) => ({
      section,
      label: NAV_SECTION_LABELS[section],
      items: visible.filter((item) => item.section === section),
    }))
    .filter((group) => group.items.length > 0);
}
