import { isUiV2 } from "@/lib/flags/ui-version.server";
import { ChangelogScreen } from "@/features/changelog/changelog-screen";

export default async function ChangelogPage() {
  if (!(await isUiV2())) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500">
        Yenilikler sayfası yalnızca yeni arayüzde kullanılabilir.{" "}
        <a href="/?ui=v2" className="text-sky-400 underline">
          Yeni arayüze geç
        </a>
      </div>
    );
  }
  return <ChangelogScreen />;
}
