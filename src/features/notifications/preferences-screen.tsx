"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { SettingsFormFooter } from "@/features/settings/settings-form-footer";
import {
  NOTIFICATION_KIND_LABELS,
  type NotificationPreferenceRow,
} from "@/lib/notifications/kinds";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from "@/features/notifications/queries";

function prefEqual(a: NotificationPreferenceRow[], b: NotificationPreferenceRow[]) {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.kind === b[i]?.kind &&
      row.in_app === b[i]?.in_app &&
      row.email === b[i]?.email
  );
}

export function NotificationPreferencesScreen() {
  const { data: loaded = [], isLoading } = useNotificationPreferences();
  const saveMutation = useSaveNotificationPreferences();
  const [rows, setRows] = useState<NotificationPreferenceRow[]>([]);
  const [initial, setInitial] = useState<NotificationPreferenceRow[]>([]);

  useEffect(() => {
    if (isLoading) return;
    setRows(loaded);
    setInitial(loaded);
  }, [loaded, isLoading]);

  const dirty = useMemo(() => !prefEqual(rows, initial), [rows, initial]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function updateRow(kind: NotificationPreferenceRow["kind"], patch: Partial<NotificationPreferenceRow>) {
    setRows((prev) =>
      prev.map((row) => (row.kind === kind ? { ...row, ...patch } : row))
    );
  }

  async function save() {
    try {
      await saveMutation.mutateAsync(rows);
      setInitial(rows);
      toast.success("Bildirim tercihleri kaydedildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    }
  }

  function discard() {
    setRows(initial);
  }

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-1">
        <HelpTitleRow>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Bildirimler
          </h1>
        </HelpTitleRow>
        <p className="max-w-xl text-sm text-muted-foreground">
          Olay türüne göre uygulama içi ve e-posta bildirimlerini yönetin.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Tercih matrisi</h2>
          <p className="text-sm text-muted-foreground">
            Makine hataları ve stok uyarıları yalnızca uygulama içinde üretilir; e-posta
            tercihi ödeme ve teslim hatırlatmaları için geçerlidir.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Olay türü</th>
                <th className="pb-2 px-4 font-medium">Uygulama içi</th>
                <th className="pb-2 pl-4 font-medium">E-posta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.kind} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 font-medium text-foreground">
                    {NOTIFICATION_KIND_LABELS[row.kind]}
                  </td>
                  <td className="py-3 px-4">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={row.in_app}
                        onChange={(e) =>
                          updateRow(row.kind, { in_app: e.target.checked })
                        }
                      />
                      <span className="sr-only">
                        {NOTIFICATION_KIND_LABELS[row.kind]} uygulama içi
                      </span>
                    </label>
                  </td>
                  <td className="py-3 pl-4">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={row.email}
                        onChange={(e) =>
                          updateRow(row.kind, { email: e.target.checked })
                        }
                      />
                      <span className="sr-only">
                        {NOTIFICATION_KIND_LABELS[row.kind]} e-posta
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SettingsFormFooter
        dirty={dirty}
        saving={saveMutation.isPending}
        onSave={() => void save()}
        onDiscard={discard}
      />
    </div>
  );
}
