import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulkRemoveRejectReasons,
  canInviteWithRole,
  canRemoveMember,
  canUpdateMemberRole,
  inviteEmailMatchError,
  inviteExpiryError,
} from "./member-rules";

describe("canUpdateMemberRole", () => {
  const target = { userId: "u2", role: "operator" as const };

  it("owner rolü değiştirilemez", () => {
    const r = canUpdateMemberRole("owner", { userId: "u1", role: "owner" }, "admin");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /Sahibin/);
  });

  it("yönetici operatör rolünü güncelleyebilir", () => {
    assert.equal(canUpdateMemberRole("admin", target, "viewer").ok, true);
  });

  it("operatör güncelleyemez", () => {
    assert.equal(canUpdateMemberRole("operator", target, "viewer").ok, false);
  });
});

describe("canRemoveMember", () => {
  const members = [
    { userId: "owner1", role: "owner" as const },
    { userId: "u2", role: "operator" as const },
  ];

  it("başka sahip çıkarılamaz", () => {
    const twoOwners = [
      { userId: "owner1", role: "owner" as const },
      { userId: "owner2", role: "owner" as const },
    ];
    const r = canRemoveMember("owner1", "admin", twoOwners[1]!, twoOwners);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /Sahip çıkarılamaz/);
  });

  it("son sahip kendini çıkaramaz", () => {
    const solo = [{ userId: "owner1", role: "owner" as const }];
    const r = canRemoveMember("owner1", "owner", solo[0]!, solo);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /Son sahip/);
  });

  it("admin operatörü çıkarabilir", () => {
    assert.equal(
      canRemoveMember("owner1", "admin", members[1]!, members).ok,
      true
    );
  });
});

describe("canInviteWithRole", () => {
  it("owner davet edilemez", () => {
    assert.equal(canInviteWithRole("owner").ok, false);
  });

  it("admin davet edilebilir", () => {
    assert.equal(canInviteWithRole("admin").ok, true);
  });
});

describe("inviteExpiryError", () => {
  it("süresi dolmuş davet", () => {
    const r = inviteExpiryError("2020-01-01T00:00:00.000Z", Date.parse("2025-01-01"));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /süresi dolmuş/i);
  });

  it("geçerli davet", () => {
    assert.equal(
      inviteExpiryError("2099-01-01T00:00:00.000Z", Date.now()).ok,
      true
    );
  });
});

describe("inviteEmailMatchError", () => {
  it("e-posta uyuşmazlığı", () => {
    const r = inviteEmailMatchError("a@b.com", "c@d.com");
    assert.equal(r.ok, false);
  });

  it("büyük/küçük harf duyarsız", () => {
    assert.equal(inviteEmailMatchError("A@B.com", "a@b.com").ok, true);
  });
});

describe("bulkRemoveRejectReasons", () => {
  it("sahip satırını reddeder", () => {
    const members = [
      { userId: "o", role: "owner" as const },
      { userId: "x", role: "viewer" as const },
    ];
    const rejected = bulkRemoveRejectReasons("o", "owner", members, members);
    assert.ok(rejected.has("o"));
    assert.equal(rejected.has("x"), false);
  });
});
