export const RELOAD_FLAG = "examcooker:chunk-reload";
export const RELOAD_GUARD_TTL_MS = 60_000;

// Where the pre-hydration inline script (see `app/layout.tsx`) records a
// detected hydration mismatch so the `HydrationRecovery` reporter can send its
// telemetry once the page is stable.
export const HYDRATION_RECOVERY_INCIDENT_KEY = "examcooker:hydration-recovery";

// At most this many recovery reloads per TTL window, whatever their keys, so
// errors that alternate between reloads can't loop either.
export const MAX_RECOVERY_RELOADS = 2;

/** Recovery reloads claimed in the last TTL window: error key → claim time. */
export type ReloadGuard = Record<string, number>;

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const candidate = error as { message?: unknown };
  return typeof candidate.message === "string" ? candidate.message : "";
}

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const candidate = error as { name?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message = getErrorMessage(error);
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to load chunk/i.test(message) ||
    /Loading CSS chunk/i.test(message)
  );
}

// React reports hydration mismatches as *recoverable* errors (React #418/#419
// and friends). They never reach the error boundary — React discards the
// server HTML and re-renders on the client, which can leave a corrupted
// intermediate DOM (blank pages, broken images, detached click handlers) that
// strands the viewer. Production builds surface them as minified messages, so
// match both the numbered signature and the readable dev-mode text.
const HYDRATION_ERROR_NUMBERS = new Set([418, 419, 420, 421, 422, 423, 425]);

export function isHydrationError(error: unknown): boolean {
  const message = getErrorMessage(error);
  if (!message) return false;

  const minifiedMatch = message.match(/Minified React error #(\d+)/i);
  if (minifiedMatch && HYDRATION_ERROR_NUMBERS.has(Number(minifiedMatch[1]))) {
    return true;
  }

  return (
    /hydrat/i.test(message) ||
    /did not match/i.test(message) ||
    /Text content does not match/i.test(message)
  );
}

export function getChunkErrorKey(error: Error & { digest?: string }): string {
  return [
    error.name || "Error",
    error.message || "",
    error.digest || "",
  ].join(":");
}

export function getRecoveryKey(
  error: unknown,
  prefix: string,
  pathname = "",
): string {
  const candidate = (error ?? {}) as { name?: unknown; digest?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "Error";
  const digest = typeof candidate.digest === "string" ? candidate.digest : "";
  return [prefix, pathname, name, getErrorMessage(error), digest].join(":");
}

/**
 * Reads a stored guard, keeping only claims still inside the TTL window. The
 * single `{ key, timestamp }` record written by earlier builds is accepted.
 */
export function parseReloadGuard(raw: string | null, now: number): ReloadGuard {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};

  const legacy = parsed as { key?: unknown; timestamp?: unknown };
  const entries: Record<string, unknown> =
    typeof legacy.key === "string" && typeof legacy.timestamp === "number"
      ? { [legacy.key]: legacy.timestamp }
      : (parsed as Record<string, unknown>);

  const guard: ReloadGuard = {};
  for (const [key, timestamp] of Object.entries(entries)) {
    if (typeof timestamp === "number" && now - timestamp < RELOAD_GUARD_TTL_MS) {
      guard[key] = timestamp;
    }
  }
  return guard;
}

/**
 * Decides whether an error may trigger a recovery reload: once per key, and
 * no more than MAX_RECOVERY_RELOADS in total per TTL window.
 */
export function claimReloadInGuard(
  guard: ReloadGuard,
  key: string,
  now: number,
): { allowed: boolean; guard: ReloadGuard } {
  if (key in guard || Object.keys(guard).length >= MAX_RECOVERY_RELOADS) {
    return { allowed: false, guard };
  }
  return { allowed: true, guard: { ...guard, [key]: now } };
}

function readReloadGuard(now: number): ReloadGuard {
  try {
    return parseReloadGuard(window.sessionStorage.getItem(RELOAD_FLAG), now);
  } catch {
    return {};
  }
}

function writeReloadGuard(guard: ReloadGuard): boolean {
  try {
    window.sessionStorage.setItem(RELOAD_FLAG, JSON.stringify(guard));
    return true;
  } catch {
    return false;
  }
}

export function clearReloadGuard() {
  try {
    window.sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // Ignore storage access errors.
  }
}

export function claimChunkReload(key: string): boolean {
  const now = Date.now();
  const claim = claimReloadInGuard(readReloadGuard(now), key, now);
  // Without storage there is no loop protection, so never reload then.
  return claim.allowed && writeReloadGuard(claim.guard);
}
