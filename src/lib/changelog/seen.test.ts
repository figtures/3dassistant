import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLatestChangelogVersion } from "@/content/changelog";
import { isChangelogUnread } from "@/lib/changelog/seen";

describe("isChangelogUnread", () => {
  it("returns false when there is no latest version", () => {
    assert.equal(isChangelogUnread(null, null), false);
  });

  it("returns true when nothing was seen yet", () => {
    assert.equal(isChangelogUnread("2.4.0", null), true);
    assert.equal(isChangelogUnread("2.4.0", undefined), true);
  });

  it("returns false when seen matches latest", () => {
    assert.equal(isChangelogUnread("2.4.0", "2.4.0"), false);
  });

  it("returns true when seen is an older release", () => {
    assert.equal(isChangelogUnread("2.4.0", "2.3.0"), true);
  });
});

describe("getLatestChangelogVersion", () => {
  it("returns the first release version", () => {
    assert.equal(getLatestChangelogVersion([{ version: "1.0.0", date: "", title: "", items: [] }]), "1.0.0");
  });
});
