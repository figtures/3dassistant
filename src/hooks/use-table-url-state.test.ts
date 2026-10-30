import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTableUrlSnapshot,
  patchTableSearchParams,
  serializeTableUrlState,
} from "./use-table-url-state";

describe("serializeTableUrlState", () => {
  it("drops excluded keys and empty values", () => {
    const params = new URLSearchParams(
      "q=test&page=2&order=abc&status=pending&empty="
    );
    const state = serializeTableUrlState(params, { excludeKeys: ["order"] });
    assert.deepEqual(state, {
      q: "test",
      page: "2",
      status: "pending",
    });
  });
});

describe("applyTableUrlSnapshot", () => {
  it("replaces filter keys but preserves modal param", () => {
    const current = new URLSearchParams("q=old&order=sheet-1&tab=all");
    const next = applyTableUrlSnapshot(
      current,
      { q: "new", page: "1", status: "pending" },
      { excludeKeys: ["order"], preserveKeys: ["order"] }
    );
    assert.equal(next.get("order"), "sheet-1");
    assert.equal(next.get("q"), "new");
    assert.equal(next.get("page"), "1");
    assert.equal(next.get("status"), "pending");
    assert.equal(next.get("tab"), null);
  });
});

describe("patchTableSearchParams", () => {
  it("sets and removes keys", () => {
    const base = new URLSearchParams("q=1&page=3");
    const next = patchTableSearchParams(base, { q: null, tab: "overdue" });
    assert.equal(next.get("q"), null);
    assert.equal(next.get("page"), "3");
    assert.equal(next.get("tab"), "overdue");
  });
});
