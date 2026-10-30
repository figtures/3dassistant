import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function MaterialsV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default async function MaterialsLoading() {
  if (await isUiV2()) {
    return <MaterialsV2Loading />;
  }
  return <PageLoader />;
}
