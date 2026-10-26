export type RecentEntryType = "customer" | "job" | "machine" | "catalog";

export type RecentEntry = {
  id: string;
  type: RecentEntryType;
  title: string;
  href: string;
};

const STORAGE_KEY = "pf.recent";
const MAX_RECENT = 8;

function readRaw(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentEntry);
  } catch {
    return [];
  }
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.type === "string" &&
    typeof v.title === "string" &&
    typeof v.href === "string"
  );
}

export function getRecentEntries(): RecentEntry[] {
  return readRaw();
}

export function pushRecent(entry: RecentEntry): void {
  if (typeof window === "undefined") return;
  const deduped = readRaw().filter(
    (item) => !(item.type === entry.type && item.id === entry.id)
  );
  const next = [entry, ...deduped].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage dolu veya devre dışı — sessizce yoksay
  }
}
