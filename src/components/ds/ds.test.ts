import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  badgeToneVariants,
  buttonVariants,
  machineStateBadgeVariants,
  MACHINE_STATE_LABELS,
} from "./variants";

describe("buttonVariants", () => {
  it("maps primary md to token classes", () => {
    const classes = buttonVariants({ variant: "primary", size: "md" });
    assert.match(classes, /bg-primary/);
    assert.match(classes, /text-primary-foreground/);
    assert.match(classes, /rounded-lg/);
    assert.match(classes, /focus-visible:shadow-\[var\(--focus-ring\)\]/);
  });

  it("maps danger and icon size", () => {
    const classes = buttonVariants({ variant: "danger", size: "icon" });
    assert.match(classes, /bg-destructive/);
    assert.match(classes, /size-9/);
  });
});

describe("badgeToneVariants", () => {
  it("maps semantic tones to subtle backgrounds", () => {
    assert.match(badgeToneVariants({ tone: "success" }), /bg-success-subtle/);
    assert.match(badgeToneVariants({ tone: "danger" }), /text-destructive/);
  });
});

describe("machineStateBadgeVariants", () => {
  it("uses state-* text tokens for printing", () => {
    assert.match(
      machineStateBadgeVariants({ state: "printing" }),
      /text-state-printing/
    );
  });

  it("has Turkish labels for every state", () => {
    const states = Object.keys(MACHINE_STATE_LABELS) as (keyof typeof MACHINE_STATE_LABELS)[];
    assert.equal(states.length, 8);
    for (const state of states) {
      assert.ok(MACHINE_STATE_LABELS[state].length > 0);
    }
  });
});
