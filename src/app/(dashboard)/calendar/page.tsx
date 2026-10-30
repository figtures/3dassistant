import { isUiV2 } from "@/lib/flags/ui-version.server";
import CalendarLegacyPage from "@/legacy/pages/calendar-page";
import { CalendarV2 } from "@/features/calendar/calendar-screen";

export default async function CalendarPage() {
  if (await isUiV2()) {
    return <CalendarV2 />;
  }
  return <CalendarLegacyPage />;
}
