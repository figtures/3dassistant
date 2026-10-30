import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GO_NAV_ROUTES,
  GO_SEQUENCE_MS,
  INITIAL_GO_STATE,
  resolveShortcut,
} from "@/lib/shortcuts/registry";

describe("resolveShortcut", () => {
  it("maps ? and / without modifiers", () => {
    assert.equal(
      resolveShortcut({ key: "?" }, INITIAL_GO_STATE, { enabled: true }).dispatch
        .type,
      "showShortcuts"
    );
    assert.equal(
      resolveShortcut({ key: "/" }, INITIAL_GO_STATE, { enabled: true }).dispatch
        .type,
      "focusPageSearch"
    );
  });

  it("starts G sequence then navigates on second key", () => {
    const t0 = 1_000;
    const first = resolveShortcut({ key: "g" }, INITIAL_GO_STATE, {
      enabled: true,
      now: t0,
    });
    assert.equal(first.dispatch.type, "startGoSequence");
    assert.equal(first.goState.pending, true);

    const second = resolveShortcut(
      { key: "O" },
      first.goState,
      { enabled: true, now: t0 + 200 }
    );
    assert.equal(second.dispatch.type, "navigate");
    if (second.dispatch.type === "navigate") {
      assert.equal(second.dispatch.href, GO_NAV_ROUTES.o.href);
    }
  });

  it("expires G sequence after timeout", () => {
    const t0 = 5_000;
    const first = resolveShortcut({ key: "G" }, INITIAL_GO_STATE, {
      enabled: true,
      now: t0,
    });
    const late = resolveShortcut(
      { key: "d" },
      first.goState,
      { enabled: true, now: t0 + GO_SEQUENCE_MS + 1 }
    );
    assert.equal(late.goState.pending, false);
    assert.equal(late.dispatch.type, "none");
  });

  it("returns none when disabled", () => {
    assert.equal(
      resolveShortcut({ key: "?" }, INITIAL_GO_STATE, { enabled: false }).dispatch
        .type,
      "none"
    );
  });

  it("maps table keys", () => {
    assert.equal(
      resolveShortcut({ key: "j" }, INITIAL_GO_STATE, { enabled: true }).dispatch
        .type,
      "tableNext"
    );
    assert.equal(
      resolveShortcut({ key: "K" }, INITIAL_GO_STATE, { enabled: true }).dispatch
        .type,
      "tablePrev"
    );
  });
});
