"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { CHANGELOG_RELEASES, getLatestChangelogVersion } from "@/content/changelog";
import { ChangelogList } from "@/features/changelog/changelog-list";
import { markChangelogSeen } from "@/lib/changelog/seen";

export function ChangelogScreen() {
  useEffect(() => {
    const latest = getLatestChangelogVersion(CHANGELOG_RELEASES);
    if (latest) markChangelogSeen(latest);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <header className="space-y-1 border-b border-border pb-6">
        <HelpTitleRow>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Sparkles className="size-6 text-primary" aria-hidden />
            Yenilikler
          </h1>
        </HelpTitleRow>
        <p className="text-sm text-muted-foreground">
          3D Assistant güncellemeleri — en yeni sürümler üstte. Yeni bir sürüm yayınlandığında
          kenar çubuğunda bildirim noktası görünür; bu sayfayı açınca okundu sayılır.
        </p>
      </header>
      <ChangelogList />
    </div>
  );
}
