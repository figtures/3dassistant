import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBreadcrumbs, groupNavItems, NAV_ITEMS } from "@/lib/nav";

describe("getBreadcrumbs", () => {
  it("maps known routes", () => {
    assert.deepEqual(getBreadcrumbs("/machines"), [
      { label: "Makineler", href: undefined },
    ]);
    assert.deepEqual(getBreadcrumbs("/planning"), [
      { label: "Planlama", href: undefined },
    ]);
  });

  it("builds nested paths", () => {
    const crumbs = getBreadcrumbs("/machines/abc-123");
    assert.equal(crumbs.length, 2);
    assert.equal(crumbs[0].label, "Makineler");
    assert.equal(crumbs[0].href, "/machines");
    assert.equal(crumbs[1].label, "Detay");
    assert.equal(crumbs[1].href, undefined);
  });
});

describe("groupNavItems", () => {
  it("hides admin routes for non-admin", () => {
    const groups = groupNavItems(NAV_ITEMS, { isAdmin: false });
    const all = groups.flatMap((g) => g.items);
    assert.ok(!all.some((i) => i.id === "support-admin"));
  });

  it("shows admin routes for admin", () => {
    const groups = groupNavItems(NAV_ITEMS, { isAdmin: true });
    const all = groups.flatMap((g) => g.items);
    assert.ok(all.some((i) => i.id === "support-admin"));
  });
});
