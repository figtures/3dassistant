import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  groupNotificationsByDay,
  labelNotificationDay,
} from "./group-by-day";
import type { Notification } from "@/types/database";

function n(created_at: string): Notification {
  return {
    id: created_at,
    workspace_id: "ws",
    user_id: "u",
    kind: "system",
    title: "Test",
    body: null,
    href: null,
    seen_at: null,
    done_at: null,
    created_at,
  };
}

describe("labelNotificationDay", () => {
  it("bugün ve dün etiketleri", () => {
    const now = new Date("2026-10-30T12:00:00.000Z");
    assert.equal(
      labelNotificationDay("2026-10-30T08:00:00.000Z", now),
      "Bugün"
    );
    assert.equal(
      labelNotificationDay("2026-10-29T08:00:00.000Z", now),
      "Dün"
    );
  });
});

describe("groupNotificationsByDay", () => {
  it("gün anahtarına göre gruplar", () => {
    const groups = groupNotificationsByDay(
      [
        n("2026-10-30T10:00:00.000Z"),
        n("2026-10-29T10:00:00.000Z"),
        n("2026-10-30T11:00:00.000Z"),
      ],
      new Date("2026-10-30T12:00:00.000Z")
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.items.length, 2);
    assert.equal(groups[0]?.label, "Bugün");
  });
});
