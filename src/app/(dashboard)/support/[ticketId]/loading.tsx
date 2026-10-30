import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function TicketV2Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-full max-w-md" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export default async function SupportTicketLoading() {
  if (await isUiV2()) {
    return <TicketV2Loading />;
  }
  return <PageLoader />;
}
