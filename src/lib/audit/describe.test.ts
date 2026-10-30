import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeAuditEvent, summarizeAuditDiff } from "./describe";
import type { AuditEvent } from "@/types/database";

const base: Omit<AuditEvent, "id"> = {
  workspace_id: "ws-1",
  actor_id: "u-1",
  action: "update",
  entity: "jobs",
  entity_id: "job-1",
  diff: null,
  created_at: "2026-01-01T10:00:00.000Z",
};

describe("describeAuditEvent", () => {
  it("formats job status change in Turkish", () => {
    const event: AuditEvent = {
      ...base,
      id: 1,
      diff: {
        status: { old: "pending", new: "in_progress" },
      },
    };
    const sentence = describeAuditEvent(event, {
      actorName: "Selin",
      entityLabels: { "job-1": "Vazo" },
    });
    assert.equal(
      sentence,
      "Selin, 'Vazo' siparişinin durumunu Üretimde olarak değiştirdi"
    );
  });

  it("describes job creation", () => {
    const event: AuditEvent = {
      ...base,
      id: 2,
      action: "insert",
      diff: { title: "Vazo", status: "pending" },
    };
    const sentence = describeAuditEvent(event, {
      actorName: "Selin",
    });
    assert.equal(sentence, "Selin, 'Vazo' siparişini oluşturdu");
  });

  it("summarizes multi-field updates", () => {
    const event: AuditEvent = {
      ...base,
      id: 3,
      diff: {
        status: { old: "pending", new: "completed" },
        payment_status: { old: "unpaid", new: "paid" },
      },
    };
    const summary = summarizeAuditDiff(event);
    assert.match(summary, /durum:/);
    assert.match(summary, /ödeme durumu:/);
  });
});
