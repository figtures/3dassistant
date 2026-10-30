import type { PlanKey } from "@/lib/billing/plans";
import type { Machine, MachineConnectionStatus } from "@/types/database";

export const ONBOARDING_STEP_IDS = [
  "connect_printer",
  "add_machine",
  "add_material",
  "first_order",
  "add_customer",
  "choose_plan",
  "invite_team",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStepStatus =
  | "pending"
  | "partial"
  | "complete"
  | "skipped"
  | "hidden";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  status: OnboardingStepStatus;
  href: string;
};

export type OnboardingUserMetadata = {
  dismissedAt?: string | null;
  skipped?: OnboardingStepId[];
  planChoice?: "free_continue" | "paid";
  workshop?: {
    machineCountRange?: string;
    usage?: string;
  };
  wizardCompletedAt?: string | null;
  /** Kurulum kontrol listesi tamamlandığında (P2-04) */
  setupCompletedAt?: string | null;
};

/** Tamamlandıktan sonra kartın otomatik gizlenmesi (3 gün) */
export const SETUP_CHECKLIST_AUTO_HIDE_MS = 3 * 24 * 60 * 60 * 1000;

export type ComputeOnboardingInput = {
  machines: Pick<Machine, "connection_status">[];
  materialsCount: number;
  jobsCount: number;
  customersCount: number;
  planKey: PlanKey;
  metadata: OnboardingUserMetadata | null | undefined;
  /** P3 öncesi ekip daveti adımı gizli kalır */
  showInviteTeam?: boolean;
};

export type OnboardingProgress = {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  isComplete: boolean;
  dismissed: boolean;
};

const STEP_LABELS: Record<OnboardingStepId, string> = {
  connect_printer: "Yazıcı bağla",
  add_machine: "Makine ekle",
  add_material: "Filament ekle",
  first_order: "İlk sipariş",
  add_customer: "Müşteri ekle",
  choose_plan: "Plan seç",
  invite_team: "Ekip davet et",
};

const STEP_HREFS: Record<OnboardingStepId, string> = {
  connect_printer: "/machines/connect",
  add_machine: "/machines?new=1",
  add_material: "/materials",
  first_order: "/orders?order=new",
  add_customer: "/customers?new=1",
  choose_plan: "/billing",
  invite_team: "/settings/team",
};

function hasConnectedPrinter(machines: Pick<Machine, "connection_status">[]): boolean {
  return machines.some((m) => m.connection_status === "connected");
}

function isSkipped(
  id: OnboardingStepId,
  metadata: OnboardingUserMetadata | null | undefined
): boolean {
  return Boolean(metadata?.skipped?.includes(id));
}

function resolveAddMachineStatus(
  machines: Pick<Machine, "connection_status">[],
  skipped: boolean
): OnboardingStepStatus {
  if (skipped) return "skipped";
  if (machines.length === 0) return "pending";
  if (!hasConnectedPrinter(machines)) return "partial";
  return "complete";
}

function resolveConnectPrinterStatus(
  machines: Pick<Machine, "connection_status">[],
  skipped: boolean
): OnboardingStepStatus {
  if (skipped) return "skipped";
  if (machines.length === 0) return "pending";
  if (hasConnectedPrinter(machines)) return "complete";
  return "partial";
}

function resolveCountStep(
  count: number,
  skipped: boolean
): OnboardingStepStatus {
  if (skipped) return "skipped";
  return count > 0 ? "complete" : "pending";
}

function resolveChoosePlanStatus(
  planKey: PlanKey,
  metadata: OnboardingUserMetadata | null | undefined,
  skipped: boolean
): OnboardingStepStatus {
  if (skipped) return "skipped";
  if (planKey !== "free") return "complete";
  if (metadata?.planChoice === "free_continue" || metadata?.planChoice === "paid") {
    return "complete";
  }
  return "pending";
}

function countsAsCompleted(status: OnboardingStepStatus): boolean {
  return status === "complete" || status === "skipped";
}

export function computeOnboarding(input: ComputeOnboardingInput): OnboardingProgress {
  const metadata = input.metadata ?? {};
  const skippedSet = new Set(metadata.skipped ?? []);

  const stepIds: OnboardingStepId[] = ONBOARDING_STEP_IDS.filter((id) => {
    if (id === "invite_team") return input.showInviteTeam === true;
    return true;
  });

  const statuses: Record<OnboardingStepId, OnboardingStepStatus> = {
    connect_printer: resolveConnectPrinterStatus(
      input.machines,
      skippedSet.has("connect_printer")
    ),
    add_machine: resolveAddMachineStatus(input.machines, skippedSet.has("add_machine")),
    add_material: resolveCountStep(input.materialsCount, skippedSet.has("add_material")),
    first_order: resolveCountStep(input.jobsCount, skippedSet.has("first_order")),
    add_customer: resolveCountStep(input.customersCount, skippedSet.has("add_customer")),
    choose_plan: resolveChoosePlanStatus(
      input.planKey,
      metadata,
      skippedSet.has("choose_plan")
    ),
    invite_team: input.showInviteTeam
      ? resolveCountStep(0, skippedSet.has("invite_team"))
      : "hidden",
  };

  const steps: OnboardingStep[] = stepIds.map((id) => ({
    id,
    label: STEP_LABELS[id],
    status: statuses[id],
    href: STEP_HREFS[id],
  }));

  const visible = steps.filter((s) => s.status !== "hidden");
  const completed = visible.filter((s) => countsAsCompleted(s.status)).length;
  const total = visible.length;
  const dismissed = Boolean(metadata.dismissedAt);

  return {
    steps,
    completed,
    total,
    isComplete: total > 0 && completed >= total,
    dismissed,
  };
}

/** Test ve sunucu tarafı sayım için yardımcı */
export function machineConnectionCounts(
  machines: Pick<Machine, "connection_status">[]
): { total: number; connected: number } {
  let connected = 0;
  for (const m of machines) {
    if (m.connection_status === ("connected" satisfies MachineConnectionStatus)) {
      connected += 1;
    }
  }
  return { total: machines.length, connected };
}

export function shouldShowSetupChecklist(
  input: {
    dismissed: boolean;
    isComplete: boolean;
    setupCompletedAt?: string | null;
  },
  nowMs = Date.now()
): boolean {
  if (input.dismissed) return false;
  if (input.isComplete && input.setupCompletedAt) {
    const completedAt = Date.parse(input.setupCompletedAt);
    if (
      !Number.isNaN(completedAt) &&
      nowMs - completedAt > SETUP_CHECKLIST_AUTO_HIDE_MS
    ) {
      return false;
    }
  }
  return true;
}

export function mergeOnboardingMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Partial<OnboardingUserMetadata>
): { onboarding: OnboardingUserMetadata } & Record<string, unknown> {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const current =
    base.onboarding && typeof base.onboarding === "object"
      ? (base.onboarding as OnboardingUserMetadata)
      : {};
  return {
    ...base,
    onboarding: { ...current, ...patch },
  };
}
