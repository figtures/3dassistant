import { isUiV2 } from "@/lib/flags/ui-version.server";
import { TeamScreen } from "@/features/team/team-screen";

export default async function TeamSettingsPage() {
  if (!(await isUiV2())) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Ekip yönetimi yalnızca yeni arayüzde kullanılabilir.
      </div>
    );
  }
  return <TeamScreen />;
}
