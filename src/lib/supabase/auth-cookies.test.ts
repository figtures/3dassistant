import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  hasSupabaseAuthCookie,
  shouldSkipSupabaseAuthRefresh,
} from "./auth-cookies";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("auth-cookies", () => {
  it("detects sb auth token cookies", () => {
    const r = req("http://localhost/login");
    r.cookies.set("sb-proj-auth-token", "x");
    assert.equal(hasSupabaseAuthCookie(r), true);
    r.cookies.set("sb-proj-auth-token.0", "y");
    assert.equal(hasSupabaseAuthCookie(r), true);
  });

  it("skips refresh on RSC prefetch only", () => {
    const rsc = req("http://localhost/dashboard", {
      rsc: "1",
      accept: "*/*",
    });
    assert.equal(shouldSkipSupabaseAuthRefresh(rsc), true);
  });

  it("refreshes session on document navigation even with RSC header", () => {
    const doc = req("http://localhost/dashboard", {
      rsc: "1",
      accept: "text/html,application/xhtml+xml",
      "sec-fetch-dest": "document",
    });
    assert.equal(shouldSkipSupabaseAuthRefresh(doc), false);
  });
});
