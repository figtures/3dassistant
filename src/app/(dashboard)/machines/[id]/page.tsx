import { MachineDetailPanel } from "@/components/machines/machine-detail-panel";

type Props = { params: Promise<{ id: string }> };

export default async function MachineDetailPage({ params }: Props) {
  const { id } = await params;
  return <MachineDetailPanel machineId={id} />;
}
