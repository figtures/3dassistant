"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHANGELOG_SEEN_EVENT,
  CHANGELOG_SEEN_KEY,
  hasUnreadChangelog,
} from "@/lib/changelog/seen";

export function useChangelogUnread(): boolean {
  const [unread, setUnread] = useState(false);

  const sync = useCallback(() => {
    setUnread(hasUnreadChangelog());
  }, []);

  useEffect(() => {
    sync();
    function onStorage(e: StorageEvent) {
      if (e.key === CHANGELOG_SEEN_KEY || e.key === null) sync();
    }
    function onSeen() {
      sync();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGELOG_SEEN_EVENT, onSeen);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGELOG_SEEN_EVENT, onSeen);
    };
  }, [sync]);

  return unread;
}
