import { Button } from "@/components/ds";
import { Info } from "lucide-react";

export type UntrackedBannerProps = {
  count: number;
  onConnect: () => void;
};

export function UntrackedBanner({ count, onConnect }: UntrackedBannerProps) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p>
          <span className="tabular-nums font-medium text-foreground">{count}</span>{" "}
          makine canlı takip edilmiyor. Yazıcı bağlayarak durumları tek ekrandan
          izleyebilirsiniz.
        </p>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onConnect}>
        Yazıcı bağla
      </Button>
    </div>
  );
}
