import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isJobOverdueForReminder,
  shouldSendReminderNow,
} from "./overdue-reminders";

describe("isJobOverdueForReminder", () => {
  it("tamamlanan işler gecikmiş sayılmaz", () => {
    assert.equal(
      isJobOverdueForReminder({
        delivery_date: "2020-01-01",
        status: "completed",
      }),
      false
    );
  });

  it("termin günü henüz hatırlatma başlamaz", () => {
    const today = new Date();
    const delivery = today.toISOString().slice(0, 10);
    assert.equal(
      isJobOverdueForReminder({
        delivery_date: delivery,
        status: "pending",
      }),
      false
    );
  });

  it("terminden 2 gün sonra hatırlatma uygun", () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    assert.equal(
      isJobOverdueForReminder({
        delivery_date: d.toISOString().slice(0, 10),
        status: "in_progress",
      }),
      true
    );
  });
});

describe("shouldSendReminderNow", () => {
  it("hiç gönderilmemişse hemen gönder", () => {
    assert.equal(shouldSendReminderNow({ last_overdue_reminder_at: null }), true);
  });

  it("son 1 saat içinde gönderildiyse atla", () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    assert.equal(shouldSendReminderNow({ last_overdue_reminder_at: recent }), false);
  });

  it("1 saatten eskiyse tekrar gönder", () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    assert.equal(shouldSendReminderNow({ last_overdue_reminder_at: old }), true);
  });
});
