import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseUiParam,
  readUiV2DefaultFromEnv,
  resolveUiVersion,
} from "@/lib/flags/ui-version.shared";

describe("parseUiParam", () => {
  it("accepts v1 and v2", () => {
    assert.equal(parseUiParam("v1"), "v1");
    assert.equal(parseUiParam("v2"), "v2");
  });

  it("rejects other values", () => {
    assert.equal(parseUiParam("v3"), null);
    assert.equal(parseUiParam(""), null);
    assert.equal(parseUiParam(null), null);
  });
});

describe("readUiV2DefaultFromEnv", () => {
  it("reads UI_V2_DEFAULT and NEXT_PUBLIC_UI_V2_DEFAULT", () => {
    assert.equal(readUiV2DefaultFromEnv({ UI_V2_DEFAULT: "true" }), true);
    assert.equal(
      readUiV2DefaultFromEnv({ NEXT_PUBLIC_UI_V2_DEFAULT: "1" }),
      true
    );
    assert.equal(readUiV2DefaultFromEnv({}), false);
  });
});

describe("resolveUiVersion", () => {
  it("prefers cookie over env", () => {
    assert.equal(
      resolveUiVersion({ cookie: "v1", env: { UI_V2_DEFAULT: "true" } }),
      "v1"
    );
    assert.equal(
      resolveUiVersion({ cookie: "v2", env: null }),
      "v2"
    );
  });

  it("uses env default when cookie missing", () => {
    assert.equal(resolveUiVersion({ cookie: null, env: "true" }), "v2");
    assert.equal(resolveUiVersion({ cookie: undefined, env: "false" }), "v1");
    assert.equal(resolveUiVersion({}), "v1");
    assert.equal(
      resolveUiVersion({
        cookie: null,
        env: { NEXT_PUBLIC_UI_V2_DEFAULT: "true" },
      }),
      "v2"
    );
  });
});
