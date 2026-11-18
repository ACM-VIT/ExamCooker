import type { AiTextTask } from "@/lib/ai/models";

export type AiGateFeature = AiTextTask | "voice";

export type AiGateRequest = {
  feature: AiGateFeature | "settings";
  promise: Promise<boolean>;
  /** Resolves the request once; later calls are ignored. */
  settle: (configured: boolean) => void;
};

export function createAiGateRequest(feature: AiGateFeature | "settings"): AiGateRequest {
  let resolve!: (configured: boolean) => void;
  let settled = false;
  const promise = new Promise<boolean>((next) => { resolve = next; });
  return {
    feature,
    promise,
    settle: (configured) => {
      if (settled) return;
      settled = true;
      resolve(configured);
    },
  };
}

/** Voice needs an OpenAI Live key; every other feature needs the text provider's key. */
function sameRequirement(a: AiGateFeature, b: AiGateFeature) {
  return (a === "voice") === (b === "voice");
}

/**
 * Decides what a request queued behind another one does once that one settles.
 * A prompt the user cancelled also answers queued requests that need the same
 * key, so they are not re-prompted. Anything else gets its own check.
 */
export function queuedRequestNeedsOwnCheck(
  settledFeature: AiGateFeature | "settings",
  settledReady: boolean,
  queuedFeature: AiGateFeature,
) {
  if (settledReady || settledFeature === "settings") return true;
  return !sameRequirement(settledFeature, queuedFeature);
}
