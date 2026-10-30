import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function CatalogV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="aspect-[4/3] rounded-xl" />
        <Skeleton className="aspect-[4/3] rounded-xl" />
        <Skeleton className="aspect-[4/3] rounded-xl" />
      </div>
    </div>
  );
}

export default async function CatalogLoading() {
  if (await isUiV2()) {
    return <CatalogV2Loading />;
  }
  return <PageLoader />;
}
