import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransitionSupportStatus } from "./status";

describe("canTransitionSupportStatus", () => {
  it("allows open to in_progress and resolved", () => {
    assert.equal(canTransitionSupportStatus("open", "in_progress"), true);
    assert.equal(canTransitionSupportStatus("open", "resolved"), true);
  });

  it("disallows open to open as change but allows same", () => {
    assert.equal(canTransitionSupportStatus("open", "open"), true);
  });

  it("allows resolved to reopen", () => {
    assert.equal(canTransitionSupportStatus("resolved", "open"), true);
  });
});
