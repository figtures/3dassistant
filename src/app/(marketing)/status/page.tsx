import type { Metadata } from "next";
import { STATUS_INCIDENTS } from "@/content/incidents";
import { StatusPageScreen } from "@/features/status/status-page-screen";
import {
  STATUS_HISTORY_DAYS,
  buildServiceSnapshots,
  fetchStatusCheckRows,
  overallPageStatus,
} from "@/lib/status/checks";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Sistem durumu",
  description:
    "3D Asisstant uygulama, bulut senkronu, köprü ve e-posta servislerinin güncel durumu ve son 90 günlük çalışma süresi.",
};

export default async function StatusPage() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - STATUS_HISTORY_DAYS);

  const supabase = await createClient();
  const rows = await fetchStatusCheckRows(supabase, since);
  const now = new Date();
  const services = buildServiceSnapshots(rows, now);
  const overall = overallPageStatus(services);

  return (
    <StatusPageScreen
      overall={overall}
      services={services}
      incidents={STATUS_INCIDENTS}
    />
  );
}
