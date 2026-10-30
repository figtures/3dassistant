import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function CatalogItemV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default async function CatalogItemLoading() {
  if (await isUiV2()) {
    return <CatalogItemV2Loading />;
  }
  return <PageLoader />;
}
