import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkspaceRole } from "@/types/database";
import {
  can,
  canViewFinance,
  isNavItemVisible,
  NAV_ITEM_ACTION,
  WORKSPACE_ACTIONS,
  type WorkspaceAction,
} from "./permissions";
import { WORKSPACE_ROLES } from "@/types/database";

/** 03-ux §4.2 — beklenen matris (her hücre test edilir). */
const MATRIX: Record<WorkspaceAction, Record<WorkspaceRole, boolean>> = {
  "orders.view": {
    owner: true,
    admin: true,
    operator: true,
    accountant: true,
    viewer: true,
  },
  "orders.edit": {
    owner: true,
    admin: true,
    operator: true,
    accountant: false,
    viewer: false,
  },
  "finance.view": {
    owner: true,
    admin: true,
    operator: false,
    accountant: true,
    viewer: false,
  },
  "finance.edit": {
    owner: true,
    admin: true,
    operator: false,
    accountant: true,
    viewer: false,
  },
  "machines.view": {
    owner: true,
    admin: true,
    operator: true,
    accountant: false,
    viewer: false,
  },
  "machines.manage": {
    owner: true,
    admin: true,
    operator: false,
    accountant: false,
    viewer: false,
  },
  "faults.edit": {
    owner: true,
    admin: true,
    operator: true,
    accountant: false,
    viewer: false,
  },
  "materials.view": {
    owner: true,
    admin: true,
    operator: true,
    accountant: true,
    viewer: false,
  },
  "materials.stock": {
    owner: true,
    admin: true,
    operator: true,
    accountant: false,
    viewer: false,
  },
  "materials.procurement": {
    owner: true,
    admin: true,
    operator: false,
    accountant: true,
    viewer: false,
  },
  "customers.view": {
    owner: true,
    admin: true,
    operator: true,
    accountant: true,
    viewer: false,
  },
  "customers.edit": {
    owner: true,
    admin: true,
    operator: true,
    accountant: false,
    viewer: false,
  },
  "export.data": {
    owner: true,
    admin: true,
    operator: false,
    accountant: true,
    viewer: false,
  },
  "team.manage": {
    owner: true,
    admin: true,
    operator: false,
    accountant: false,
    viewer: false,
  },
  "billing.view": {
    owner: true,
    admin: false,
    operator: false,
    accountant: true,
    viewer: false,
  },
  "billing.manage": {
    owner: true,
    admin: false,
    operator: false,
    accountant: false,
    viewer: false,
  },
  "audit.view": {
    owner: true,
    admin: true,
    operator: false,
    accountant: false,
    viewer: false,
  },
  "workspace.edit": {
    owner: true,
    admin: true,
    operator: false,
    accountant: false,
    viewer: false,
  },
  "workspace.delete": {
    owner: true,
    admin: false,
    operator: false,
    accountant: false,
    viewer: false,
  },
  "settings.personal": {
    owner: true,
    admin: true,
    operator: true,
    accountant: true,
    viewer: true,
  },
};

describe("can — rol matrisi", () => {
  for (const action of WORKSPACE_ACTIONS) {
    for (const role of WORKSPACE_ROLES) {
      it(`${role} · ${action}`, () => {
        assert.equal(can(role, action), MATRIX[action][role]);
      });
    }
  }

  it("null rol reddedilir", () => {
    assert.equal(can(null, "orders.view"), false);
  });
});

describe("canViewFinance", () => {
  it("operatör ve izleyici false", () => {
    assert.equal(canViewFinance("operator"), false);
    assert.equal(canViewFinance("viewer"), false);
  });

  it("muhasebe true", () => {
    assert.equal(canViewFinance("accountant"), true);
  });
});

describe("NAV_ITEM_ACTION", () => {
  it("tüm ana menü öğeleri tanımlı", () => {
    const ids = [
      "dashboard",
      "planning",
      "orders",
      "calendar",
      "machines",
      "faults",
      "materials",
      "procurement",
      "catalog",
      "customers",
      "billing",
      "support",
      "settings",
    ];
    for (const id of ids) {
      assert.ok(NAV_ITEM_ACTION[id], `eksik: ${id}`);
    }
  });
});

describe("isNavItemVisible", () => {
  it("izleyici yalnızca dashboard ve sipariş görür", () => {
    const ctx = { role: "viewer" as const, isSupportAdmin: false };
    assert.equal(isNavItemVisible({ id: "orders" }, ctx), true);
    assert.equal(isNavItemVisible({ id: "machines" }, ctx), false);
    assert.equal(isNavItemVisible({ id: "materials" }, ctx), false);
  });

  it("destek admin rotası yalnızca destek admin", () => {
    assert.equal(
      isNavItemVisible(
        { id: "support-admin", adminOnly: true },
        { role: "owner", isSupportAdmin: false }
      ),
      false
    );
    assert.equal(
      isNavItemVisible(
        { id: "support-admin", adminOnly: true },
        { role: "operator", isSupportAdmin: true }
      ),
      true
    );
  });

  it("muhasebe tedarik görür, planlama görmez", () => {
    const ctx = { role: "accountant" as const };
    assert.equal(isNavItemVisible({ id: "procurement" }, ctx), true);
    assert.equal(isNavItemVisible({ id: "planning" }, ctx), false);
  });
});
