import { isUiV2 } from "@/lib/flags/ui-version.server";
import CustomersLegacyPage from "@/legacy/pages/customers-page";
import { CustomersV2 } from "@/features/customers/CustomersV2";

export default async function CustomersPage() {
  if (await isUiV2()) {
    return <CustomersV2 />;
  }
  return <CustomersLegacyPage />;
}
