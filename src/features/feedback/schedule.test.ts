import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NPS_MIN_DAYS_AFTER_SIGNUP,
  NPS_REPEAT_DAYS,
  NPS_SNOOZE_DAYS,
  shouldShowCsatPrompt,
  shouldShowNpsPrompt,
  snoozeUntilFromNow,
} from "@/features/feedback/schedule";

describe("shouldShowNpsPrompt", () => {
  const signup = new Date("2026-01-01T12:00:00.000Z");

  it("hides before minimum days after signup", () => {
    const now = new Date("2026-01-10T12:00:00.000Z");
    assert.equal(
      shouldShowNpsPrompt({
        now,
        userCreatedAt: signup,
        lastNpsSubmittedAt: null,
        snoozedUntil: null,
      }),
      false
    );
  });

  it("shows after minimum days when never submitted", () => {
    const now = new Date("2026-01-16T12:00:00.000Z");
    assert.equal(
      shouldShowNpsPrompt({
        now,
        userCreatedAt: signup,
        lastNpsSubmittedAt: null,
        snoozedUntil: null,
      }),
      true
    );
  });

  it("respects snooze until date", () => {
    const now = new Date("2026-02-01T12:00:00.000Z");
    assert.equal(
      shouldShowNpsPrompt({
        now,
        userCreatedAt: signup,
        lastNpsSubmittedAt: null,
        snoozedUntil: new Date("2026-02-15T00:00:00.000Z"),
      }),
      false
    );
  });

  it("repeats every 90 days after last submission", () => {
    const last = new Date("2026-01-20T12:00:00.000Z");
    const tooSoon = new Date("2026-03-01T12:00:00.000Z");
    const ready = new Date("2026-04-25T12:00:00.000Z");

    assert.equal(
      shouldShowNpsPrompt({
        now: tooSoon,
        userCreatedAt: signup,
        lastNpsSubmittedAt: last,
        snoozedUntil: null,
      }),
      false
    );
    assert.equal(
      shouldShowNpsPrompt({
        now: ready,
        userCreatedAt: signup,
        lastNpsSubmittedAt: last,
        snoozedUntil: null,
      }),
      true
    );
  });
});

describe("snoozeUntilFromNow", () => {
  it(`adds ${NPS_SNOOZE_DAYS} calendar days`, () => {
    const now = new Date("2026-05-01T08:00:00.000Z");
    const until = snoozeUntilFromNow(now);
    assert.equal(until.toISOString(), "2026-05-31T08:00:00.000Z");
  });
});

describe("shouldShowCsatPrompt", () => {
  it("shows only for resolved tickets without prior response", () => {
    assert.equal(shouldShowCsatPrompt("resolved", false), true);
    assert.equal(shouldShowCsatPrompt("resolved", true), false);
    assert.equal(shouldShowCsatPrompt("open", false), false);
  });
});

describe("schedule constants", () => {
  it("matches product spec", () => {
    assert.equal(NPS_MIN_DAYS_AFTER_SIGNUP, 14);
    assert.equal(NPS_REPEAT_DAYS, 90);
    assert.equal(NPS_SNOOZE_DAYS, 30);
  });
});
