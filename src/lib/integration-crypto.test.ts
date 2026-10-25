import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "./integration-crypto";

describe("integration-crypto", () => {
  it("round-trips with encryption key", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "test-integration-key-32-chars-min!!";
    const plain = "prusa-secret-token-abc";
    const enc = encryptIntegrationSecret(plain);
    assert.ok(enc.startsWith("enc:v1:"));
    assert.notEqual(enc, plain);
    assert.equal(decryptIntegrationSecret(enc), plain);
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  });

  it("passes through plaintext when not encrypted", () => {
    assert.equal(decryptIntegrationSecret("legacy-plain"), "legacy-plain");
  });
});
