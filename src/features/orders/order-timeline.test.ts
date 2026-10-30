import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrderTimelineEvents } from "@/features/orders/order-timeline";

const base = {
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
  status: "pending" as const,
  payment_status: "unpaid" as const,
  amount_paid: 0,
  revenue_amount: 1000,
  payment_due_date: null,
  installment_count: null,
  installment_amount: null,
  job_notes: [],
};

describe("buildOrderTimelineEvents", () => {
  it("includes creation and sorts newest first", () => {
    const events = buildOrderTimelineEvents(base);
    assert.ok(events.some((e) => e.id === "created"));
    const createdIdx = events.findIndex((e) => e.id === "created");
    assert.ok(createdIdx >= 0);
  });

  it("adds notes and status snapshot when updated", () => {
    const events = buildOrderTimelineEvents({
      ...base,
      updated_at: "2026-01-02T12:00:00.000Z",
      status: "in_progress",
      job_notes: [
        {
          id: "n1",
          job_id: "j1",
          content: "Müşteri aradı",
          is_voice: false,
          parsed_data: null,
          created_at: "2026-01-01T11:00:00.000Z",
        },
      ],
    });
    assert.ok(events.some((e) => e.id === "note-n1"));
    assert.ok(events.some((e) => e.id === "status-snapshot"));
    const times = events.map((e) => new Date(e.at).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });

  it("records payment and installments", () => {
    const events = buildOrderTimelineEvents({
      ...base,
      updated_at: "2026-01-03T08:00:00.000Z",
      amount_paid: 500,
      payment_status: "partial",
      installment_count: 4,
      installment_amount: 250,
      payment_due_date: "2026-02-01",
    });
    assert.ok(events.some((e) => e.id === "payment-recorded"));
    assert.ok(events.some((e) => e.id === "payment-due"));
    assert.ok(events.some((e) => e.id === "installments"));
  });
});
