import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function CustomerDetailV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export default async function CustomerDetailLoading() {
  if (await isUiV2()) {
    return <CustomerDetailV2Loading />;
  }
  return <PageLoader />;
}
