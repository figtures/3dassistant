import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { humanizeAuthError } from "./humanize";

describe("humanizeAuthError", () => {
  it("maps invalid_credentials", () => {
    const err = Object.assign(new Error("Invalid"), { code: "invalid_credentials" });
    assert.equal(humanizeAuthError(err), "E-posta veya şifre hatalı.");
  });

  it("maps weak_password", () => {
    const err = Object.assign(new Error("Weak"), { code: "weak_password" });
    assert.match(humanizeAuthError(err), /zayıf/i);
  });

  it("falls back for unknown", () => {
    assert.match(humanizeAuthError(new Error("x")), /ters gitti/i);
  });

  it("maps over_request_rate_limit", () => {
    const err = Object.assign(new Error("Rate limit"), {
      code: "over_request_rate_limit",
      status: 429,
    });
    assert.match(humanizeAuthError(err), /dakika/i);
  });
});
