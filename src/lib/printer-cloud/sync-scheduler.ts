export type SchedulableLink = {
  id: string;
  user_id: string;
  integration_account_id: string;
  last_synced_at: string | null;
};

/**
 * Bir cron tick'inde senkronlanacak bağlantıları seçer.
 * Girdi en eski senkron önce sıralı olmalı. Her kiracı kendi plan kotasını
 * (`perUserLimit`) aşamaz; toplam `totalCap` ile sınırlanır. Sıra `last_synced_at`
 * ile döndüğü için büyük kiracılar küçükleri aç bırakmaz.
 */
export function selectLinksForTick<T extends SchedulableLink>(
  candidates: T[],
  perUserLimit: Map<string, number>,
  totalCap: number
): T[] {
  const taken = new Map<string, number>();
  const selected: T[] = [];
  for (const link of candidates) {
    if (selected.length >= totalCap) break;
    const limit = perUserLimit.get(link.user_id) ?? 0;
    const used = taken.get(link.user_id) ?? 0;
    if (used >= limit) continue;
    taken.set(link.user_id, used + 1);
    selected.push(link);
  }
  return selected;
}

export function groupByAccount<T extends SchedulableLink>(links: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const link of links) {
    const list = groups.get(link.integration_account_id);
    if (list) list.push(link);
    else groups.set(link.integration_account_id, [link]);
  }
  return [...groups.values()];
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}
