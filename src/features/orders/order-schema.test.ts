import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyOrderForm,
  orderFormSchema,
  toSchemaPayload,
  validateOrderForm,
} from "@/features/orders/order-schema";

describe("orderFormSchema", () => {
  it("requires title, machine and job_date", () => {
    const form = emptyOrderForm();
    const result = validateOrderForm(form);
    assert.equal(result.success, false);
  });

  it("rejects amount_paid greater than revenue", () => {
    const form = emptyOrderForm({ machine_id: "m1", job_date: "2026-01-01" });
    form.title = "Vazo";
    form.revenue_amount = "100";
    form.amount_paid = "150";
    const parsed = orderFormSchema.safeParse(toSchemaPayload(form));
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(
        parsed.error.issues.some((i) => i.path.includes("amount_paid"))
      );
    }
  });

  it("accepts valid order", () => {
    const form = emptyOrderForm({ machine_id: "m1", job_date: "2026-01-01" });
    form.title = "Vazo";
    form.revenue_amount = "450";
    form.amount_paid = "200";
    form.grams_used = "120";
    const parsed = validateOrderForm(form);
    assert.equal(parsed.success, true);
  });
});
