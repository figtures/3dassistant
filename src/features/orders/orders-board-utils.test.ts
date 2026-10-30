import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Job } from "@/types/database";
import {
  findJobStatusInColumns,
  jobsToKanbanColumns,
} from "@/features/orders/orders-board-utils";

function job(partial: Partial<Job> & Pick<Job, "id" | "status">): Job {
  return {
    user_id: "u",
    machine_id: "m",
    job_date: "2026-01-01",
    title: partial.title ?? "Test",
    created_at: "",
    updated_at: "",
    ...partial,
  } as Job;
}

describe("jobsToKanbanColumns", () => {
  it("groups jobs by status", () => {
    const columns = jobsToKanbanColumns([
      job({ id: "1", status: "pending" }),
      job({ id: "2", status: "in_progress" }),
      job({ id: "3", status: "pending" }),
    ]);
    assert.equal(columns.pending.length, 2);
    assert.equal(columns.in_progress.length, 1);
    assert.equal(columns.completed.length, 0);
  });
});

describe("findJobStatusInColumns", () => {
  it("finds column for job id", () => {
    const columns = jobsToKanbanColumns([
      job({ id: "a", status: "completed" }),
    ]);
    assert.equal(findJobStatusInColumns(columns, "a"), "completed");
    assert.equal(findJobStatusInColumns(columns, "missing"), null);
  });
});
