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

let enginePromise: Promise<PdfiumEngine> | null = null;
let cachedEngine: PdfiumEngine | null = null;
let cachedError: unknown = null;

export function preloadPdfiumEngine() {
  if (cachedEngine) {
    return Promise.resolve(cachedEngine);
  }

  if (enginePromise) {
    return enginePromise;
  }

  cachedError = null;
  enginePromise = import("@embedpdf/engines/pdfium-direct-engine")
    .then(({ createPdfiumEngine }) =>
      createPdfiumEngine(PDFIUM_WASM_URL, {
        fontFallback: { fonts: {} },
      })
    )
    .then((engine) => {
      cachedEngine = engine;
      return engine;
    })
    .catch((error) => {
      cachedError = error;
      enginePromise = null;
      throw error;
    });

  return enginePromise;
}

type PdfiumEngineAction =
  | { type: "loading" }
  | { type: "loaded"; engine: PdfiumEngine }
  | { type: "error"; error: unknown; reason: PdfiumEngineErrorReason };

function getInitialPdfiumEngineState(): PdfiumEngineState {
  if (cachedEngine) {
    return { status: "loaded", engine: cachedEngine, error: null };
  }

  if (cachedError) {
    return {
      status: "error",
      engine: null,
      error: cachedError,
      reason: "engine_error",
    };
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

    if (cachedEngine) {
      dispatch({ type: "loaded", engine: cachedEngine });
      return () => {
        isActive = false;
      };
    }

    // On an explicit retry, drop a stale in-flight or previously-failed attempt
    // so we actually re-create the engine instead of re-awaiting a promise that
    // may already be hung — otherwise "Retry viewer" could never recover an
    // engine timeout. (A normal rejection already nulls `enginePromise`, but a
    // timed-out promise is still pending, so reset it explicitly here.)
    if (retryKey > 0) {
      enginePromise = null;
      cachedError = null;
    }

    dispatch({ type: "loading" });

    // Hard deadline mirroring the viewer's document-load watchdog: a
    // `createPdfiumEngine` promise that never settles used to hang the viewer on
    // "Loading PDF engine" indefinitely. Promote the hang into the recoverable
    // error UI so the failure is both visible and reportable.
    const timeoutId = window.setTimeout(() => {
      if (!isActive) return;
      dispatch({
        type: "error",
        error: new Error("PDF engine load timed out"),
        reason: "engine_timeout",
      });
    }, PDFIUM_ENGINE_LOAD_TIMEOUT_MS);

    preloadPdfiumEngine()
      .then((engine) => {
        if (!isActive) return;
        window.clearTimeout(timeoutId);
        dispatch({ type: "loaded", engine });
      })
      .catch((error) => {
        if (!isActive) return;
        window.clearTimeout(timeoutId);
        dispatch({ type: "error", error, reason: "engine_error" });
      });

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [retryKey]);

  return state;
}
