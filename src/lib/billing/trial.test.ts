import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APP_TRIAL_DAYS,
  parseSignupIntent,
  trialDaysRemaining,
  trialPeriodEndIso,
} from "./trial";

describe("parseSignupIntent", () => {
  it("trial=1 ve plan ile niyet okur", () => {
    assert.deepEqual(parseSignupIntent({ signup: { plan: "farm", trial: true } }), {
      plan: "farm",
      trial: true,
    });
  });

  it("plan yoksa pro varsayılan", () => {
    assert.deepEqual(parseSignupIntent({ signup: { trial: "1" } }), {
      plan: "pro",
      trial: true,
    });
  });

  it("trial yoksa null", () => {
    assert.equal(parseSignupIntent({ signup: { plan: "pro" } }), null);
  });
});

describe("trialDaysRemaining", () => {
  it("kalan günü yukarı yuvarlar", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    const end = "2026-01-03T01:00:00Z";
    assert.equal(trialDaysRemaining(end, now), 2);
  });

  it("süre dolduysa 0", () => {
    const now = Date.parse("2026-02-01T00:00:00Z");
    assert.equal(trialDaysRemaining("2026-01-01T00:00:00Z", now), 0);
  });
});

describe("trialPeriodEndIso", () => {
  it("14 gün ekler", () => {
    const from = Date.parse("2026-01-01T00:00:00Z");
    const end = Date.parse(trialPeriodEndIso(from));
    const days = (end - from) / (24 * 60 * 60 * 1000);
    assert.equal(days, APP_TRIAL_DAYS);
  });
});
