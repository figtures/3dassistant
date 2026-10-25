import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  llmJobRawToNote,
  mapLlmToFormResult,
  validateLlmPayload,
} from "./voice-llm";
import type { VoiceFormApplyResult } from "./parse-note";

describe("validateLlmPayload", () => {
  it("job alanlarını doğrular", () => {
    const v = validateLlmPayload("job", {
      customerName: "Ahmet Yılmaz",
      gramsUsed: 150,
      materialName: "PETG",
      status: "completed",
    });
    assert.equal(v.ok, true);
  });

  it("geçersiz status reddedilir", () => {
    const v = validateLlmPayload("job", { status: "done" });
    assert.equal(v.ok, false);
  });
});

describe("llmJobRawToNote + mapLlmToFormResult", () => {
  it("LLM JSON malzeme ve müşteriyi eşleştirir", () => {
    const raw = {
      gramsUsed: "200",
      materialName: "PLA",
      customerName: "Ayşe Demir",
      status: "in_progress" as const,
    };
    const note = llmJobRawToNote(raw);
    assert.match(note, /200 gram/);
    assert.match(note, /PLA/);

    const result = mapLlmToFormResult("job", raw, {
      materials: [
        {
          id: "m1",
          name: "PLA",
          material_colors: [{ id: "c1", color_name: "Siyah" }],
        },
      ],
      customers: [{ id: "u1", name: "Ayşe Demir" }],
    }) as VoiceFormApplyResult;

    assert.equal(result.materialId, "m1");
    assert.equal(result.customerId, "u1");
    assert.ok(result.matched.includes("Gram"));
  });
});

describe("OPENAI integration", () => {
  it("anahtar yoksa atlanır", { skip: !!process.env.OPENAI_API_KEY }, () => {
    assert.ok(true);
  });
});
