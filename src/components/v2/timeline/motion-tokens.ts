/** 21st Timeline (#35051) motion presets — Forge token uyumlu. */
export const motionTokens = {
  ease: {
    enter: [0, 0, 0.2, 1] as const,
    standard: [0.4, 0, 0.2, 1] as const,
  },
  spring: {
    smooth: { type: "spring" as const, stiffness: 320, damping: 32 },
    morph: { type: "spring" as const, stiffness: 420, damping: 28 },
    snappy: { type: "spring" as const, stiffness: 520, damping: 34 },
  },
  duration: {
    standard: 0.22,
    fast: 0.14,
  },
  blur: {
    soft: 4,
    subtle: 2,
  },
};
