import { isUiV2 } from "@/lib/flags/ui-version.server";
import CustomerDetailLegacyPage from "@/legacy/pages/customer-detail-page";
import { CustomerDetailScreen } from "@/features/customers/customer-detail-screen";

export default async function CustomerDetailPage({
  params,
}: PageProps<"/customers/[id]">) {
  const { id } = await params;
  if (await isUiV2()) {
    return <CustomerDetailScreen customerId={id} />;
  }
  return <CustomerDetailLegacyPage params={Promise.resolve({ id })} />;
}
