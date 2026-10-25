import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMeshMetricsFromPositions,
  cubeMeshPositionsMm,
  estimateWeightGrams,
  mm3ToCm3,
} from "./mesh-metrics";

describe("mesh-metrics", () => {
  it("10 mm küp hacmi 1 cm³", () => {
    const positions = cubeMeshPositionsMm(10);
    const m = computeMeshMetricsFromPositions(positions);
    assert.ok(Math.abs(m.volumeCm3 - 1) < 0.01, `volume=${m.volumeCm3}`);
    assert.ok(Math.abs(m.boundingBox.widthCm - 1) < 0.01);
    assert.ok(Math.abs(m.boundingBox.heightCm - 1) < 0.01);
    assert.ok(Math.abs(m.boundingBox.depthCm - 1) < 0.01);
    assert.equal(m.triangleCount, 12);
  });

  it("100 mm küp hacmi 1000 cm³", () => {
    const positions = cubeMeshPositionsMm(100);
    const m = computeMeshMetricsFromPositions(positions);
    assert.ok(Math.abs(m.volumeCm3 - 1000) < 1, `volume=${m.volumeCm3}`);
  });

  it("mm³ → cm³ dönüşümü", () => {
    assert.equal(mm3ToCm3(1000), 1);
  });

  it("tahmini ağırlık", () => {
    const g = estimateWeightGrams(10, 1.24);
    assert.ok(Math.abs(g - 12.4) < 0.001);
  });
});
