import { Skeleton } from "@/components/ds/skeleton";

function OrdersV2Loading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-10 w-full max-w-2xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function OrdersLoading() {
  return <OrdersV2Loading />;
}
