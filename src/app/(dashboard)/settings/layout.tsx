import { isUiV2 } from "@/lib/flags/ui-version.server";
import { SettingsSubnav } from "@/components/v2/settings/settings-subnav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const v2 = await isUiV2();

  if (!v2) {
    return <div className="p-6">{children}</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 pb-8 lg:flex-row lg:gap-10">
      <SettingsSubnav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
