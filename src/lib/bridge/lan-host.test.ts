import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidLanHost } from "./lan-host";

describe("isValidLanHost", () => {
  it("accepts IPv4 and local hostnames", () => {
    assert.equal(isValidLanHost("192.168.1.151"), true);
    assert.equal(isValidLanHost("k2pro-f9a7.local"), true);
  });

  it("rejects malformed input", () => {
    assert.equal(isValidLanHost("192.168.1.256"), false);
    assert.equal(isValidLanHost("http://192.168.1.5"), false);
    assert.equal(isValidLanHost("a b"), false);
    assert.equal(isValidLanHost(""), false);
  });
});
