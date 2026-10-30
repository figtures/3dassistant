import { isUiV2 } from "@/lib/flags/ui-version.server";
import { Skeleton } from "@/components/ds/skeleton";
import { PageLoader } from "@/components/ui/skeleton";

function CustomersV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default async function CustomersLoading() {
  if (await isUiV2()) {
    return <CustomersV2Loading />;
  }
  return <PageLoader />;
}
