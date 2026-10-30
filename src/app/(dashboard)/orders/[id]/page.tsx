import { redirect } from "next/navigation";
import { isUiV2 } from "@/lib/flags/ui-version.server";
import { OrderDetailScreen } from "@/features/orders/order-detail-screen";

export default async function OrderDetailPage({
  params,
}: PageProps<"/orders/[id]">) {
  const { id } = await params;
  if (!(await isUiV2())) {
    redirect(`/orders?order=${encodeURIComponent(id)}`);
  }
  return <OrderDetailScreen orderId={id} />;
}
