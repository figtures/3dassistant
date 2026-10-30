import { helpDefault } from "@/content/help/default";
import { helpBilling } from "@/content/help/billing";
import { helpChangelog } from "@/content/help/changelog";
import { helpCalendar } from "@/content/help/calendar";
import { helpCatalog } from "@/content/help/catalog";
import { helpCatalogDetail } from "@/content/help/catalog-detail";
import { helpCustomers } from "@/content/help/customers";
import { helpCustomersDetail } from "@/content/help/customers-detail";
import { helpDashboard } from "@/content/help/dashboard";
import { helpFaults } from "@/content/help/faults";
import { helpMachines } from "@/content/help/machines";
import { helpMachinesConnect } from "@/content/help/machines-connect";
import { helpMachinesDetail } from "@/content/help/machines-detail";
import { helpMaterials } from "@/content/help/materials";
import { helpOrders } from "@/content/help/orders";
import { helpOrdersDetail } from "@/content/help/orders-detail";
import { helpPlanning } from "@/content/help/planning";
import { helpProcurement } from "@/content/help/procurement";
import { helpSupport } from "@/content/help/support";
import type { PageHelpContent } from "@/content/help/types";
import { helpRouteKeyFromPathname } from "@/lib/help/route-key";

const HELP_BY_KEY: Record<string, PageHelpContent> = {
  dashboard: helpDashboard,
  orders: helpOrders,
  "orders-detail": helpOrdersDetail,
  planning: helpPlanning,
  calendar: helpCalendar,
  machines: helpMachines,
  "machines-detail": helpMachinesDetail,
  "machines-connect": helpMachinesConnect,
  faults: helpFaults,
  materials: helpMaterials,
  procurement: helpProcurement,
  catalog: helpCatalog,
  "catalog-detail": helpCatalogDetail,
  customers: helpCustomers,
  "customers-detail": helpCustomersDetail,
  billing: helpBilling,
  support: helpSupport,
  changelog: helpChangelog,
};

export function getPageHelp(pathname: string): PageHelpContent {
  const key = helpRouteKeyFromPathname(pathname);
  return HELP_BY_KEY[key] ?? helpDefault;
}
