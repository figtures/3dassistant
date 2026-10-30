import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function CalendarV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
    </div>
  );
}

export default async function CalendarLoading() {
  if (await isUiV2()) {
    return <CalendarV2Loading />;
  }
  return <PageLoader />;
}
