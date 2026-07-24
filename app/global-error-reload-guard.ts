export const RELOAD_FLAG = "examcooker:chunk-reload";
export const RELOAD_GUARD_TTL_MS = 60_000;
export const HYDRATION_RECOVERY_KEY_PREFIX = "hydration";

// Where the pre-hydration inline script (see `app/layout.tsx`) records a
// detected hydration mismatch so the `HydrationRecovery` reporter can send its
// telemetry once the page is stable.
export const HYDRATION_RECOVERY_INCIDENT_KEY = "examcooker:hydration-recovery";

type ReloadGuard = {
  key: string;
  timestamp: number;
};

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

export function getRecoveryKey(error: unknown, prefix: string): string {
  const candidate = (error ?? {}) as { name?: unknown; digest?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "Error";
  const digest = typeof candidate.digest === "string" ? candidate.digest : "";
  return [prefix, name, getErrorMessage(error), digest].join(":");
}

export function getHydrationRecoveryKey(error: unknown): string {
  return getRecoveryKey(error, HYDRATION_RECOVERY_KEY_PREFIX);
}

export function getHydrationRecoveryInitScript(): string {
  const hydrationErrorNumbers = Object.fromEntries(
    Array.from(HYDRATION_ERROR_NUMBERS, (errorNumber) => [errorNumber, 1]),
  );

  return `(function(){try{var FLAG=${JSON.stringify(
    RELOAD_FLAG,
  )},INC=${JSON.stringify(
    HYDRATION_RECOVERY_INCIDENT_KEY,
  )},TTL=${RELOAD_GUARD_TTL_MS},PREFIX=${JSON.stringify(
    HYDRATION_RECOVERY_KEY_PREFIX,
  )},NUMS=${JSON.stringify(
    hydrationErrorNumbers,
  )},handledKey=null;function isHy(m){if(!m)return false;m=''+m;var l=m.toLowerCase();var i=m.indexOf('Minified React error #');if(i!==-1){var n='';for(var j=i+22;j<m.length;j++){var c=m.charCodeAt(j);if(c>=48&&c<=57){n+=m.charAt(j);}else{break;}}if(n&&NUMS[+n])return true;}return l.indexOf('hydrat')!==-1||l.indexOf('did not match')!==-1||l.indexOf('text content does not match')!==-1;}function keyFor(err,msg){var name=err&&typeof err.name==='string'?err.name:'Error';var digest=err&&typeof err.digest==='string'?err.digest:'';return [PREFIX,name,msg,digest].join(':');}window.addEventListener('error',function(e){var err=e&&e.error,msg=(err&&err.message)||(e&&e.message)||'';if(!isHy(msg))return;var key=keyFor(err,msg);if(handledKey===key)return;handledKey=key;var reload=false;try{var raw=sessionStorage.getItem(FLAG),fresh=false;if(raw){var g=JSON.parse(raw);fresh=!!g&&g.key===key&&(Date.now()-g.timestamp)<TTL;}if(!fresh){sessionStorage.setItem(FLAG,JSON.stringify({key:key,timestamp:Date.now()}));reload=true;}}catch(_){}try{sessionStorage.setItem(INC,JSON.stringify({path:location.pathname+location.search,message:(''+msg).slice(0,500),reloadTriggered:reload}));}catch(_){}if(reload){location.reload();}});}catch(_){}})();`;
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
