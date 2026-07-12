const RELOAD_FLAG = "examcooker:chunk-reload";
const RELOAD_GUARD_TTL_MS = 60_000;

type ReloadGuard = {
  key: string;
  timestamp: number;
};

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to load chunk/i.test(message) ||
    /Loading CSS chunk/i.test(message)
  );
}

export function getChunkErrorKey(error: Error & { digest?: string }): string {
  return [
    error.name || "Error",
    error.message || "",
    error.digest || "",
  ].join(":");
}

function readReloadGuard(): ReloadGuard | null {
  try {
    const rawGuard = window.sessionStorage.getItem(RELOAD_FLAG);
    if (!rawGuard) return null;

    const guard = JSON.parse(rawGuard) as Partial<ReloadGuard>;
    if (typeof guard.key !== "string" || typeof guard.timestamp !== "number") {
      return null;
    }
    return { key: guard.key, timestamp: guard.timestamp };
  } catch {
    return null;
  }
}

function writeReloadGuard(key: string): boolean {
  try {
    window.sessionStorage.setItem(
      RELOAD_FLAG,
      JSON.stringify({ key, timestamp: Date.now() }),
    );
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

export function hasFreshReloadGuard(key: string): boolean {
  const guard = readReloadGuard();
  if (!guard) return false;
  return guard.key === key && Date.now() - guard.timestamp < RELOAD_GUARD_TTL_MS;
}

export function claimChunkReload(key: string): boolean {
  if (hasFreshReloadGuard(key)) return false;
  return writeReloadGuard(key);
}
