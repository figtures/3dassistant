import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactSecretsDeep, redactToken, sanitizeClientErrorMessage } from "./redact";

describe("support redact", () => {
  it("masks tokens leaving two chars", () => {
    assert.equal(redactToken("abcdef"), "ab****");
  });

  it("redacts secret keys in objects", () => {
    const out = redactSecretsDeep({
      bridgeToken: "long-secret-token",
      ok: "visible",
    }) as Record<string, string>;
    assert.equal(out.ok, "visible");
    assert.ok(out.bridgeToken.startsWith("lo"));
    assert.ok(out.bridgeToken.includes("*"));
  });

  it("sanitizes emails in error messages", () => {
    const m = sanitizeClientErrorMessage("Failed for user@test.com");
    assert.equal(m, "Failed for [e-posta]");
  });
});
