import assert from "node:assert/strict";
import {
  HYDRATION_RECOVERY_INCIDENT_KEY,
  RELOAD_FLAG,
} from "../app/global-error-reload-guard";
import { hydrationRecoveryInitScript } from "../app/hydration-recovery-script";

type ErrorHandler = (event: {
  error?: Error;
  message?: string;
}) => void;

function createMemoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
    removeItem(key: string) {
      entries.delete(key);
    },
  };
}

const realSessionStorage = globalThis.sessionStorage;
const realLocation = globalThis.location;
const realWindow = globalThis.window;

try {
  const storage = createMemoryStorage();
  const errorHandlers: ErrorHandler[] = [];
  let reloadCount = 0;

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: {
      pathname: "/native-auth/complete",
      search:
        "?code=secret-code&handoffChallenge=secret-challenge&returnTo=%2Fdashboard",
      reload() {
        reloadCount += 1;
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener(type: string, handler: ErrorHandler) {
        if (type === "error") {
          errorHandlers.push(handler);
        }
      },
    },
  });

  new Function(hydrationRecoveryInitScript)();

  assert.equal(errorHandlers.length, 1, "script installs one error listener");
  errorHandlers[0]({
    error: new Error("Minified React error #418; see https://react.dev/errors/418"),
  });

  assert.equal(reloadCount, 1, "hydration recovery still triggers guarded reload");
  assert.ok(
    storage.getItem(RELOAD_FLAG),
    "hydration recovery still writes the reload guard",
  );

  const rawIncident = storage.getItem(HYDRATION_RECOVERY_INCIDENT_KEY);
  assert.ok(rawIncident, "hydration recovery records an incident");
  const incident = JSON.parse(rawIncident);
  assert.equal(
    incident.path,
    "/native-auth/complete",
    "incident path must not include sensitive auth query parameters",
  );
  assert.equal(
    rawIncident.includes("secret-code") || rawIncident.includes("secret-challenge"),
    false,
    "incident payload must not persist auth handoff secrets",
  );

  console.log("hydration recovery privacy tests passed");
} finally {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: realSessionStorage,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: realLocation,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: realWindow,
  });
}
