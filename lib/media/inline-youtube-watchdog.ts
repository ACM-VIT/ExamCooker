export type InlineYouTubePlaybackStatus = "loading" | "ready" | "error";

// Base budget for a single play attempt to reach a ready state before we treat
// the embed as wedged.
export const STUCK_TIMEOUT_BASE_MS = 20000;

// Arm the stuck-load watchdog only while the viewer is actively trying to play
// AND the embed has not become ready yet. A loaded-but-idle player — the common
// case, since the first open of a topic mounts the player without autoplay —
// must never be failed on elapsed time alone: nobody is watching it, so "slow"
// can't be told apart from "wedged". Measuring from a real play attempt is the
// distinction the fixed-from-mount timer was missing.
export function shouldArmStuckLoadTimeout(
  status: InlineYouTubePlaybackStatus,
  hasPlaybackIntent: boolean,
) {
  return status === "loading" && hasPlaybackIntent;
}

// Each retry gets a longer budget instead of replaying the same 20s over a slow
// connection. Attempt 0 (the first play) waits the base budget; every retry
// after that adds another base budget, so the watchdog backs off rather than
// failing the same way in a loop.
export function getStuckTimeoutMs(attempt: number) {
  const safeAttempt =
    Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return STUCK_TIMEOUT_BASE_MS * (safeAttempt + 1);
}
