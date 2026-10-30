import { PLANS, type PlanKey } from "@/lib/billing/plans";

export type MachineCountRange = "1-2" | "3-8" | "9-40" | "40+";

export function recommendPlanForRange(range: MachineCountRange): PlanKey {
  switch (range) {
    case "1-2":
      return "free";
    case "3-8":
      return "pro";
    case "9-40":
    case "40+":
      return "farm";
    default:
      return "free";
  }
}

export function planRecommendationText(range: MachineCountRange): string {
  const key = recommendPlanForRange(range);
  const plan = PLANS[key];
  const rangeLabel =
    range === "1-2"
      ? "1–2 makine"
      : range === "3-8"
        ? "3–8 makine"
        : range === "9-40"
          ? "9–40 makine"
          : "40+ makine";
  return `${rangeLabel} için ${plan.name} planı (${plan.maxMachines} makine limiti) uygun olabilir — zorunlu değil, dilediğiniz zaman değiştirebilirsiniz.`;
}
