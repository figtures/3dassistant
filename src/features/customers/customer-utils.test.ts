import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerStatsMap,
  matchesCustomerSearch,
} from "@/features/customers/customer-utils";
import type { Customer, Job } from "@/types/database";

const baseCustomer = (overrides: Partial<Customer>): Customer => ({
  id: "c1",
  user_id: "u1",
  name: "Deniz Yıldız",
  email: "deniz@ornek.com",
  phone: "05551234567",
  company: "Atölye A",
  notes: null,
  source: "Instagram",
  referral: null,
  referred_by_customer_id: null,
  created_at: "",
  updated_at: "",
  ...overrides,
});

const baseJob = (overrides: Partial<Job>): Job =>
  ({
    id: "j1",
    user_id: "u1",
    machine_id: "m1",
    customer_id: "c1",
    material_id: null,
    material_color_id: null,
    job_date: "2026-01-15",
    delivery_date: null,
    title: "Test",
    description: null,
    grams_used: 100,
    revenue_amount: 1000,
    duration_minutes: 60,
    payment_status: "partial",
    amount_paid: 400,
    amount_remaining: 600,
    payment_due_date: null,
    installment_count: null,
    installment_amount: null,
    status: "completed",
    cell_color: "#333",
    last_overdue_reminder_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  }) as Job;

describe("matchesCustomerSearch", () => {
  it("boş sorguda tüm kayıtları geçirir", () => {
    const c = baseCustomer({});
    assert.equal(matchesCustomerSearch(c, ""), true);
    assert.equal(matchesCustomerSearch(c, "   "), true);
  });

  it("ad ve firma ile eşleşir", () => {
    const c = baseCustomer({});
    assert.equal(matchesCustomerSearch(c, "deniz"), true);
    assert.equal(matchesCustomerSearch(c, "atölye"), true);
    assert.equal(matchesCustomerSearch(c, "xyz"), false);
  });
});

describe("buildCustomerStatsMap", () => {
  it("sipariş sayısı, ciro ve tahsilatı toplar", () => {
    const jobs = [
      baseJob({ id: "j1", job_date: "2026-01-10", revenue_amount: 500, amount_remaining: 100 }),
      baseJob({ id: "j2", job_date: "2026-02-01", revenue_amount: 300, amount_remaining: 0 }),
    ];
    const map = buildCustomerStatsMap(jobs);
    const stats = map.get("c1");
    assert.ok(stats);
    assert.equal(stats.orderCount, 2);
    assert.equal(stats.totalRevenue, 800);
    assert.equal(stats.pendingCollection, 100);
    assert.equal(stats.lastOrderDate, "2026-02-01");
  });
});
