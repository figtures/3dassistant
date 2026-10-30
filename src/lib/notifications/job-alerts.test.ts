import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isJobDeliveryTomorrow,
  isJobPaymentDueOverdue,
  tomorrowIsoInIstanbul,
} from "./job-alerts";

describe("job notification alerts", () => {
  it("yarın teslim filtresi", () => {
    const tomorrow = tomorrowIsoInIstanbul(new Date("2026-10-30T12:00:00.000Z"));
    assert.equal(
      isJobDeliveryTomorrow({
        delivery_date: `${tomorrow}T00:00:00.000Z`,
        status: "pending",
      }),
      true
    );
    assert.equal(
      isJobDeliveryTomorrow({
        delivery_date: "2026-11-01",
        status: "pending",
      }),
      false
    );
  });

  it("geçmiş ödeme vadesi", () => {
    assert.equal(
      isJobPaymentDueOverdue({
        payment_due_date: "2020-01-01",
        payment_status: "unpaid",
        status: "pending",
      }),
      true
    );
    assert.equal(
      isJobPaymentDueOverdue({
        payment_due_date: "2020-01-01",
        payment_status: "paid",
        status: "pending",
      }),
      false
    );
  });
});
