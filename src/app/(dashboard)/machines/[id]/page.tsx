import { isUiV2 } from "@/lib/flags/ui-version.server";
import MachineDetailLegacyPage from "@/legacy/pages/machine-detail-page";
import { MachineDetailScreen } from "@/features/machines/machine-detail-screen";

type Props = { params: Promise<{ id: string }> };

export default async function MachineDetailPage({ params }: Props) {
  const { id } = await params;

  if (await isUiV2()) {
    return <MachineDetailScreen machineId={id} />;
  }

  return <MachineDetailLegacyPage machineId={id} />;
}
