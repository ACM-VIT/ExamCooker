"use client";

import { useEffect, useReducer } from "react";

export const PDFIUM_WASM_URL = "/vendor/embedpdf/pdfium.wasm";

// The engine-start phase (dynamic import + WASM instantiation of pdfium) had no
// deadline at all: a `createPdfiumEngine` promise that never settled parked the
// viewer on "Loading PDF engine" forever, with a purely cosmetic slow-load
// notice as its only feedback. Give it a hard watchdog, mirroring the viewer's
// document-load timeout, so a hung engine is promoted into the recoverable
// retry / open-original UI and reported instead of hanging silently.
export const PDFIUM_ENGINE_LOAD_TIMEOUT_MS = 15000;

type PdfiumEngine = Awaited<
  ReturnType<
    typeof import("@embedpdf/engines/pdfium-direct-engine").createPdfiumEngine
  >
>;

export type PdfiumEngineErrorReason = "engine_error" | "engine_timeout";

type PdfiumEngineState =
  | { status: "loading"; engine: null; error: null }
  | { status: "loaded"; engine: PdfiumEngine; error: null }
  | {
      status: "error";
      engine: null;
      error: unknown;
      reason: PdfiumEngineErrorReason;
    };

let cachedEngine: PdfiumEngine | null = null;

type PdfiumEngineAttempt = {
  generation: number;
  promise: Promise<PdfiumEngine>;
};

class StalePdfiumEngineAttemptError extends Error {
  constructor() {
    super("PDF engine attempt was superseded");
    this.name = "StalePdfiumEngineAttemptError";
  }
}

let nextAttemptGeneration = 0;
let currentAttempt: PdfiumEngineAttempt | null = null;

function destroyPdfiumEngine(engine: PdfiumEngine) {
  try {
    const task = engine.destroy?.();
    void task?.toPromise().catch(() => undefined);
  } catch {
    // A superseded engine must never interfere with the active retry.
  }
}

function createPdfiumEngineAttempt(): PdfiumEngineAttempt {
  const generation = ++nextAttemptGeneration;
  const promise = import("@embedpdf/engines/pdfium-direct-engine")
    .then(({ createPdfiumEngine }) =>
      createPdfiumEngine(PDFIUM_WASM_URL, {
        fontFallback: { fonts: {} },
      }),
    )
    .then((engine) => {
      if (currentAttempt?.generation !== generation) {
        destroyPdfiumEngine(engine);
        throw new StalePdfiumEngineAttemptError();
      }

      cachedEngine = engine;
      currentAttempt = null;
      return engine;
    })
    .catch((error) => {
      if (error instanceof StalePdfiumEngineAttemptError) {
        throw error;
      }

      // A superseded attempt is stale whether it eventually resolves or rejects.
      // Do not let its late rejection surface as the active retry's failure.
      if (currentAttempt?.generation !== generation) {
        throw new StalePdfiumEngineAttemptError();
      }

      currentAttempt = null;
      throw error;
    });

  const attempt = { generation, promise };
  currentAttempt = attempt;
  return attempt;
}

function getOrCreatePdfiumEngineAttempt() {
  return currentAttempt ?? createPdfiumEngineAttempt();
}

function invalidatePdfiumEngineAttempt(expectedGeneration?: number) {
  if (!currentAttempt) return false;
  if (
    expectedGeneration !== undefined &&
    currentAttempt.generation !== expectedGeneration
  ) {
    return false;
  }

  currentAttempt = null;
  return true;
}

export function preloadPdfiumEngine() {
  if (cachedEngine) {
    return Promise.resolve(cachedEngine);
  }

  return getOrCreatePdfiumEngineAttempt().promise;
}

type PdfiumEngineAction =
  | { type: "loading" }
  | { type: "loaded"; engine: PdfiumEngine }
  | { type: "error"; error: unknown; reason: PdfiumEngineErrorReason };

function getInitialPdfiumEngineState(): PdfiumEngineState {
  if (cachedEngine) {
    return { status: "loaded", engine: cachedEngine, error: null };
  }

  return { status: "loading", engine: null, error: null };
}

function pdfiumEngineReducer(
  state: PdfiumEngineState,
  action: PdfiumEngineAction,
): PdfiumEngineState {
  switch (action.type) {
    case "loading":
      if (state.status === "loading") return state;
      return { status: "loading", engine: null, error: null };
    case "loaded":
      return { status: "loaded", engine: action.engine, error: null };
    case "error":
      return {
        status: "error",
        engine: null,
        error: action.error,
        reason: action.reason,
      };
    default:
      return state;
  }
}

export function usePreloadedPdfiumEngine(retryKey = 0): PdfiumEngineState {
  const [state, dispatch] = useReducer(
    pdfiumEngineReducer,
    undefined,
    getInitialPdfiumEngineState,
  );

  useEffect(() => {
    let isActive = true;
    let watchVersion = 0;
    let timeoutId: number | null = null;

    const clearWatchdog = () => {
      if (timeoutId === null) return;
      window.clearTimeout(timeoutId);
      timeoutId = null;
    };

    if (cachedEngine) {
      dispatch({ type: "loaded", engine: cachedEngine });
      return () => {
        isActive = false;
      };
    }

    // On an explicit retry, drop a stale in-flight or previously-failed attempt
    // so we actually re-create the engine instead of re-awaiting a promise that
    // may already be hung — otherwise "Retry viewer" could never recover an
    // engine timeout. Attempt generations ensure the abandoned promise cannot
    // later overwrite this retry or populate the shared cache.
    if (retryKey > 0) {
      invalidatePdfiumEngineAttempt();
    }

    dispatch({ type: "loading" });

    const watchCurrentAttempt = () => {
      if (!isActive) return;
      if (cachedEngine) {
        clearWatchdog();
        dispatch({ type: "loaded", engine: cachedEngine });
        return;
      }

      const version = ++watchVersion;
      const attempt = getOrCreatePdfiumEngineAttempt();
      clearWatchdog();

      // Hard deadline mirroring the viewer's document-load watchdog: invalidate
      // only this exact attempt. If another consumer already started a newer
      // generation, join that generation instead of timing it out early.
      timeoutId = window.setTimeout(() => {
        if (!isActive || version !== watchVersion) return;
        timeoutId = null;

        if (!invalidatePdfiumEngineAttempt(attempt.generation)) {
          watchCurrentAttempt();
          return;
        }

        // Make the timed-out promise's eventual resolution/rejection inert for
        // this hook. Its module-level completion path will destroy a late engine.
        watchVersion += 1;
        dispatch({
          type: "error",
          error: new Error("PDF engine load timed out"),
          reason: "engine_timeout",
        });
      }, PDFIUM_ENGINE_LOAD_TIMEOUT_MS);

      attempt.promise
        .then((engine) => {
          if (!isActive || version !== watchVersion) return;
          clearWatchdog();
          dispatch({ type: "loaded", engine });
        })
        .catch((error) => {
          if (!isActive || version !== watchVersion) return;
          if (error instanceof StalePdfiumEngineAttemptError) {
            watchCurrentAttempt();
            return;
          }

          clearWatchdog();
          dispatch({ type: "error", error, reason: "engine_error" });
        });
    };

    watchCurrentAttempt();

    return () => {
      isActive = false;
      watchVersion += 1;
      clearWatchdog();
    };
  }, [retryKey]);

  return state;
}
