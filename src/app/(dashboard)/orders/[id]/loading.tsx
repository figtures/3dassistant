import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function OrderDetailV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

export default async function OrderDetailLoading() {
  if (await isUiV2()) {
    return <OrderDetailV2Loading />;
  }
  return <PageLoader />;
}
