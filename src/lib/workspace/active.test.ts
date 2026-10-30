import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveActiveWorkspaceId } from "./active";

describe("resolveActiveWorkspaceId", () => {
  const auth = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const third = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  const memberships = [
    { workspaceId: auth, name: "Benim", role: "owner" as const },
    { workspaceId: other, name: "Ortak", role: "operator" as const },
  ];

  it("üyelik yoksa auth kullanıcı id döner", () => {
    assert.equal(resolveActiveWorkspaceId(auth, null, []), auth);
  });

  it("geçerli cookie üyeliği seçer", () => {
    assert.equal(
      resolveActiveWorkspaceId(auth, other, memberships),
      other
    );
  });

  it("geçersiz cookie sahip workspace'e düşer", () => {
    assert.equal(
      resolveActiveWorkspaceId(auth, third, memberships),
      auth
    );
  });

  it("cookie yoksa sahip olduğu workspace tercih edilir", () => {
    assert.equal(resolveActiveWorkspaceId(auth, null, memberships), auth);
  });

  it("sahip workspace yoksa ilk üyelik", () => {
    const guestOnly = [
      { workspaceId: other, name: "Ortak", role: "viewer" as const },
    ];
    assert.equal(resolveActiveWorkspaceId(auth, null, guestOnly), other);
  });
});
