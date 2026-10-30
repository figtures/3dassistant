import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeOnboarding,
  mergeOnboardingMetadata,
  SETUP_CHECKLIST_AUTO_HIDE_MS,
  shouldShowSetupChecklist,
  type OnboardingUserMetadata,
} from "./onboarding-state";

const emptyMeta: OnboardingUserMetadata = {};

function baseInput(
  overrides: Partial<Parameters<typeof computeOnboarding>[0]> = {}
) {
  return {
    machines: [],
    materialsCount: 0,
    jobsCount: 0,
    customersCount: 0,
    planKey: "free" as const,
    metadata: emptyMeta,
    showInviteTeam: false,
    ...overrides,
  };
}

describe("computeOnboarding", () => {
  it("boş hesapta tüm adımlar bekliyor", () => {
    const r = computeOnboarding(baseInput());
    assert.equal(r.completed, 0);
    assert.equal(r.total, 6);
    assert.equal(r.isComplete, false);
    assert.equal(r.dismissed, false);
    assert.ok(!r.steps.some((s) => s.id === "invite_team"));
  });

  it("bağlı yazıcı connect_printer tamamlar", () => {
    const r = computeOnboarding(
      baseInput({
        machines: [{ connection_status: "connected" }],
      })
    );
    const connect = r.steps.find((s) => s.id === "connect_printer");
    assert.equal(connect?.status, "complete");
  });

  it("makine var ama bağlı değilse add_machine kısmi", () => {
    const r = computeOnboarding(
      baseInput({
        machines: [{ connection_status: "never" }],
      })
    );
    assert.equal(r.steps.find((s) => s.id === "add_machine")?.status, "partial");
    assert.equal(r.steps.find((s) => s.id === "connect_printer")?.status, "partial");
  });

  it("malzeme, sipariş ve müşteri sayımları", () => {
    const r = computeOnboarding(
      baseInput({
        materialsCount: 2,
        jobsCount: 1,
        customersCount: 3,
      })
    );
    assert.equal(r.steps.find((s) => s.id === "add_material")?.status, "complete");
    assert.equal(r.steps.find((s) => s.id === "first_order")?.status, "complete");
    assert.equal(r.steps.find((s) => s.id === "add_customer")?.status, "complete");
  });

  it("ücretli planda choose_plan tamamlanır", () => {
    const r = computeOnboarding(baseInput({ planKey: "pro" }));
    assert.equal(r.steps.find((s) => s.id === "choose_plan")?.status, "complete");
  });

  it("ücretsiz planda planChoice free_continue ile tamamlanır", () => {
    const r = computeOnboarding(
      baseInput({
        metadata: { planChoice: "free_continue" },
      })
    );
    assert.equal(r.steps.find((s) => s.id === "choose_plan")?.status, "complete");
  });

  it("atlanan adımlar ilerlemeye sayılır", () => {
    const r = computeOnboarding(
      baseInput({
        metadata: { skipped: ["add_material", "first_order"] },
      })
    );
    assert.equal(r.steps.find((s) => s.id === "add_material")?.status, "skipped");
    assert.equal(r.completed, 2);
  });

  it("dismissed bayrağı metadata'dan okunur", () => {
    const r = computeOnboarding(
      baseInput({
        metadata: { dismissedAt: "2026-01-01T00:00:00Z" },
      })
    );
    assert.equal(r.dismissed, true);
  });

  it("tüm adımlar tamamlanınca isComplete", () => {
    const r = computeOnboarding(
      baseInput({
        machines: [{ connection_status: "connected" }],
        materialsCount: 1,
        jobsCount: 1,
        customersCount: 1,
        planKey: "starter",
      })
    );
    assert.equal(r.isComplete, true);
    assert.equal(r.completed, r.total);
  });

  it("invite_team yalnızca showInviteTeam ile görünür", () => {
    const hidden = computeOnboarding(baseInput({ showInviteTeam: false }));
    assert.ok(!hidden.steps.some((s) => s.id === "invite_team"));

    const shown = computeOnboarding(baseInput({ showInviteTeam: true }));
    assert.ok(shown.steps.some((s) => s.id === "invite_team"));
    assert.equal(shown.total, 7);
  });
});

describe("shouldShowSetupChecklist", () => {
  it("gizlenmiş kart gösterilmez", () => {
    assert.equal(
      shouldShowSetupChecklist({
        dismissed: true,
        isComplete: false,
      }),
      false
    );
  });

  it("tamamlanmadan önce gösterilir", () => {
    assert.equal(
      shouldShowSetupChecklist({
        dismissed: false,
        isComplete: false,
      }),
      true
    );
  });

  it("tamamlandıktan 3 gün sonra gizlenir", () => {
    const completedAt = new Date(
      Date.now() - SETUP_CHECKLIST_AUTO_HIDE_MS - 1000
    ).toISOString();
    assert.equal(
      shouldShowSetupChecklist(
        {
          dismissed: false,
          isComplete: true,
          setupCompletedAt: completedAt,
        },
        Date.now()
      ),
      false
    );
  });

  it("tamamlandıktan sonra 3 gün içinde gösterilir", () => {
    const completedAt = new Date().toISOString();
    assert.equal(
      shouldShowSetupChecklist({
        dismissed: false,
        isComplete: true,
        setupCompletedAt: completedAt,
      }),
      true
    );
  });
});

describe("mergeOnboardingMetadata", () => {
  it("diğer user_metadata alanlarını korur", () => {
    const merged = mergeOnboardingMetadata(
      { full_name: "Ayşe", onboarding: { skipped: ["add_material"] } },
      { planChoice: "free_continue" }
    );
    assert.equal(merged.full_name, "Ayşe");
    assert.deepEqual(merged.onboarding.skipped, ["add_material"]);
    assert.equal(merged.onboarding.planChoice, "free_continue");
  });

  it("onboarding yokken oluşturur", () => {
    const merged = mergeOnboardingMetadata({ company_name: "Atölye" }, {
      dismissedAt: "2026-02-01",
    });
    assert.equal(merged.company_name, "Atölye");
    assert.equal(merged.onboarding.dismissedAt, "2026-02-01");
  });
});
