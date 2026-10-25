import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectBridgePlatform } from "./detect-platform";

describe("detectBridgePlatform", () => {
  it("Windows", () => {
    const r = detectBridgePlatform({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      navigatorPlatform: "Win32",
    });
    assert.equal(r.status, "known");
    if (r.status === "known") assert.equal(r.platform, "windows-amd64");
  });

  it("Linux amd64", () => {
    const r = detectBridgePlatform({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      navigatorPlatform: "Linux x86_64",
    });
    assert.equal(r.status, "known");
    if (r.status === "known") assert.equal(r.platform, "linux-amd64");
  });

  it("macOS Apple Silicon via Client Hints", () => {
    const r = detectBridgePlatform({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      navigatorPlatform: "MacIntel",
      architecture: "arm",
    });
    assert.equal(r.status, "known");
    if (r.status === "known") assert.equal(r.platform, "darwin-arm64");
  });

  it("macOS Intel via Client Hints", () => {
    const r = detectBridgePlatform({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      navigatorPlatform: "MacIntel",
      architecture: "x86",
    });
    assert.equal(r.status, "known");
    if (r.status === "known") assert.equal(r.platform, "darwin-amd64");
  });

  it("mobil → unknown", () => {
    const r = detectBridgePlatform({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      navigatorPlatform: "iPhone",
    });
    assert.equal(r.status, "unknown");
  });
});
