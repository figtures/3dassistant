import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function PlanningV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-10 w-full max-w-2xl" />
      <Skeleton className="hidden h-[480px] w-full rounded-xl lg:block" />
      <Skeleton className="h-96 w-full rounded-xl lg:hidden" />
    </div>
  );
}

export default async function PlanningLoading() {
  if (await isUiV2()) {
    return <PlanningV2Loading />;
  }
  return <PageLoader />;
}
