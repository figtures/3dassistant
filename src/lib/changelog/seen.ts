import { CHANGELOG_RELEASES, getLatestChangelogVersion } from "@/content/changelog";

export const CHANGELOG_SEEN_KEY = "pf.changelog.seen";
export const CHANGELOG_SEEN_EVENT = "pf:changelog-seen";

export function isChangelogUnread(
  latestVersion: string | null,
  seenVersion: string | null | undefined
): boolean {
  if (!latestVersion) return false;
  if (!seenVersion) return true;
  return seenVersion !== latestVersion;
}

export function readChangelogSeen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHANGELOG_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markChangelogSeen(
  version: string = getLatestChangelogVersion(CHANGELOG_RELEASES) ?? ""
): void {
  if (typeof window === "undefined" || !version) return;
  try {
    window.localStorage.setItem(CHANGELOG_SEEN_KEY, version);
    window.dispatchEvent(new CustomEvent(CHANGELOG_SEEN_EVENT, { detail: version }));
  } catch {
    // localStorage dolu veya devre dışı
  }
}

export function hasUnreadChangelog(
  seenVersion: string | null | undefined = readChangelogSeen()
): boolean {
  return isChangelogUnread(getLatestChangelogVersion(CHANGELOG_RELEASES), seenVersion);
}
