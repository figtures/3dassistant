"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ds/skeleton";
import type { MeshMetrics } from "@/lib/mesh-metrics";

const StlViewer = dynamic(
  () => import("@/components/viewer/stl-viewer").then((m) => m.StlViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-border bg-surface-inset">
        <Skeleton className="h-32 w-32 rounded-lg" />
      </div>
    ),
  }
);

export type StlPreviewProps = {
  url: string | null;
  className?: string;
  onMetrics?: (metrics: MeshMetrics | null) => void;
};

export function StlPreview({ url, className, onMetrics }: StlPreviewProps) {
  if (!url) return null;
  return <StlViewer url={url} className={className} onMetrics={onMetrics} />;
}
