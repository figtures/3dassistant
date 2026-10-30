import { isUiV2 } from "@/lib/flags/ui-version.server";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function NotificationsSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }

  return (
    <div className="space-y-2 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Bildirimler
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Bildirim tercihleri P3-07 ile eklenecek. Şimdilik üst bardaki bildirim zili
        otomatik uyarıları gösterir.
      </p>
    </div>
  );
}
