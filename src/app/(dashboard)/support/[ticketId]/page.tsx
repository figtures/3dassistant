import { isUiV2 } from "@/lib/flags/ui-version.server";
import TicketLegacyPage from "@/legacy/pages/ticket-page";
import { TicketScreen } from "@/features/support/ticket-screen";

export default async function SupportTicketDetailPage({
  params,
}: PageProps<"/support/[ticketId]">) {
  const { ticketId } = await params;
  if (await isUiV2()) {
    return <TicketScreen ticketId={ticketId} />;
  }
  return <TicketLegacyPage ticketId={ticketId} />;
}
