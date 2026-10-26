import { isUiV2 } from "@/lib/flags/ui-version.server";

function MachineDetailV2Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8 motion-reduce:animate-none animate-pulse">
      <div className="h-9 w-32 rounded-lg bg-muted" />
      <div className="space-y-2">
        <div className="h-8 w-64 max-w-full rounded bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>
      <div className="h-10 w-full max-w-md rounded-lg bg-muted" />
      <div className="h-72 rounded-xl border border-border bg-card" />
    </div>
  );
}

function MachineDetailLegacyLoading() {
  return (
    <div className="space-y-8 motion-reduce:animate-none animate-pulse">
      <div className="h-10 w-48 rounded bg-zinc-800" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-2xl bg-zinc-900/60" />
        <div className="h-64 rounded-2xl bg-zinc-900/60" />
      </div>
    </div>
  );
}

export default async function MachineDetailLoading() {
  if (await isUiV2()) {
    return <MachineDetailV2Loading />;
  }
  return <MachineDetailLegacyLoading />;
}
