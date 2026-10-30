import { isUiV2 } from "@/lib/flags/ui-version.server";

function DashboardV2Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8 motion-reduce:animate-none animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 max-w-full rounded bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[88px] rounded-xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-80 rounded-xl border border-border bg-card lg:col-span-3" />
        <div className="h-80 rounded-xl border border-border bg-card lg:col-span-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[332px] rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}

function DashboardLegacyLoading() {
  return (
    <div className="space-y-8 motion-reduce:animate-none animate-pulse">
      <div className="h-10 w-48 rounded bg-zinc-800" />
      <div className="h-48 rounded-2xl bg-zinc-900/60" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-zinc-900/60" />
        ))}
      </div>
    </div>
  );
}

export default async function DashboardLoading() {
  if (await isUiV2()) {
    return <DashboardV2Loading />;
  }
  return <DashboardLegacyLoading />;
}
