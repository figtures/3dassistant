import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWorkspaceAdminRole } from "./roles";

describe("isWorkspaceAdminRole", () => {
  it("owner ve admin true döner", () => {
    assert.equal(isWorkspaceAdminRole("owner"), true);
    assert.equal(isWorkspaceAdminRole("admin"), true);
  });

  it("diğer roller false döner", () => {
    assert.equal(isWorkspaceAdminRole("operator"), false);
    assert.equal(isWorkspaceAdminRole("accountant"), false);
    assert.equal(isWorkspaceAdminRole("viewer"), false);
    assert.equal(isWorkspaceAdminRole(null), false);
    assert.equal(isWorkspaceAdminRole(undefined), false);
  });
});
