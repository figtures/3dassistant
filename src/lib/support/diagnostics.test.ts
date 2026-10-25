import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeClientDiagnostics } from "./diagnostics";

describe("support diagnostics", () => {
  it("trims and sanitizes client errors", () => {
    const out = normalizeClientDiagnostics({
      clientErrors: Array.from({ length: 30 }, (_, i) => ({
        at: "t",
        message: `err ${i} user@x.com`,
      })),
    });
    assert.equal(out.clientErrors!.length, 15);
    assert.ok(out.clientErrors![0].message.includes("[e-posta]"));
  });
});
