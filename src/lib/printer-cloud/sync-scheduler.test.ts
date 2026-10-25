import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupByAccount, runWithConcurrency, selectLinksForTick } from "./sync-scheduler";

const link = (id: string, user: string, account = `${user}-acc`) => ({
  id,
  user_id: user,
  integration_account_id: account,
  last_synced_at: null,
});

describe("selectLinksForTick", () => {
  it("respects per-tenant limits so one farm cannot starve others", () => {
    const candidates = [
      ...Array.from({ length: 30 }, (_, i) => link(`big-${i}`, "big")),
      link("small-1", "small"),
      link("small-2", "small"),
    ];
    const limits = new Map([
      ["big", 20],
      ["small", 8],
    ]);
    const picked = selectLinksForTick(candidates, limits, 40);
    assert.equal(picked.filter((l) => l.user_id === "big").length, 20);
    assert.equal(picked.filter((l) => l.user_id === "small").length, 2);
  });

  it("skips tenants without a cloud entitlement", () => {
    const picked = selectLinksForTick([link("a", "free"), link("b", "pro")], new Map([["pro", 8]]), 40);
    assert.deepEqual(picked.map((l) => l.id), ["b"]);
  });

  it("stops at the global cap", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => link(`l${i}`, `u${i}`));
    const limits = new Map(candidates.map((l) => [l.user_id, 5]));
    assert.equal(selectLinksForTick(candidates, limits, 4).length, 4);
  });
});

describe("groupByAccount", () => {
  it("keeps links of the same account together in order", () => {
    const groups = groupByAccount([link("1", "u", "A"), link("2", "u", "B"), link("3", "u", "A")]);
    assert.deepEqual(groups.map((g) => g.map((l) => l.id)), [["1", "3"], ["2"]]);
  });
});

describe("runWithConcurrency", () => {
  it("never exceeds the concurrency limit and processes every item", async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      active--;
    });
    assert.equal(peak, 2);
    assert.deepEqual(done.sort(), [1, 2, 3, 4, 5, 6]);
  });
});
