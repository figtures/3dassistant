import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parsePlanCellDroppableId,
  planCellDroppableId,
} from "@/features/planning/plan-dnd";

describe("plan cell droppable ids", () => {
  it("round-trips machine and date", () => {
    const id = planCellDroppableId("machine-1", "2026-03-15");
    assert.equal(id, "cell:machine-1:2026-03-15");
    assert.deepEqual(parsePlanCellDroppableId(id), {
      machineId: "machine-1",
      date: "2026-03-15",
    });
  });

  it("rejects invalid ids", () => {
    assert.equal(parsePlanCellDroppableId("job:1"), null);
    assert.equal(parsePlanCellDroppableId("cell:only"), null);
  });
});
