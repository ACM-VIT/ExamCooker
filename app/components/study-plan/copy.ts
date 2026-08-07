// Light, deterministic copy variation so the feature isn't one rigid branded
// label repeated everywhere. Kept plain and literal on purpose — no slogans,
// no em dashes, no exaggerated lines.

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic pick so SSR and client agree (no hydration drift). */
export function pickFrom<T>(pool: readonly T[], seed: string): T {
  return pool[hashSeed(seed) % pool.length] as T;
}

export const PLAN_TITLES = ["Study plan", "Your plan", "Prep plan"] as const;

export const BUILD_VERBS = ["Build plan", "Make plan", "Build the plan"] as const;

export const CTA_HOOKS = [
  "Build a study plan for this exam.",
  "Plan your prep for this course.",
  "Turn this course into a study plan.",
  "Make a plan before the exam.",
] as const;
