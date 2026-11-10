"use client";

import { useEffect, useReducer, useRef } from "react";
import { PDFIUM_WASM_URL } from "@/lib/generated/pdfium-wasm";

export { PDFIUM_WASM_URL };

import { loadPdfiumEngine, PdfiumEngineTimeoutError } from "./load-engine";
import { loadPdfiumWasm } from "./pdfium-wasm";
export { PDFIUM_ENGINE_LOAD_TIMEOUT_MS } from "./load-engine";

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
let pendingEngine: Promise<PdfiumEngine> | null = null;

/**
 * Start the engine download at idle, without compiling it, so a later paper
 * open reuses it. Skipped when the visitor asked to save data or is on 2G.
 */
export function prefetchPdfiumWasm() {
  // A pending build has the bytes or has just released them to the engine.
  if (cachedEngine || pendingEngine || typeof navigator === "undefined") return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? "")) return;
  void loadPdfiumWasm().catch(() => undefined);
}

export function preloadPdfiumEngine(): Promise<PdfiumEngine> {
  if (cachedEngine) return Promise.resolve(cachedEngine);
  if (pendingEngine) return pendingEngine;

  const promise = loadPdfiumEngine()
    .then((engine) => { cachedEngine = engine; return engine; })
    .finally(() => { if (pendingEngine === promise) pendingEngine = null; });
  pendingEngine = promise;
  return promise;
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
  const handledRetryKeyRef = useRef(0);

  useEffect(() => {
    let isActive = true;
    // An explicit retry builds a fresh engine: a crashed or out-of-memory
    // PDFium instance cannot be detected reliably, and reusing it fails again.
    // Viewers that still hold the old engine keep using it. Each retry does
    // this once; the effect also re-runs when a hidden route is shown again,
    // and that must not discard a healthy engine.
    if (retryKey > handledRetryKeyRef.current) {
      handledRetryKeyRef.current = retryKey;
      if (!pendingEngine) cachedEngine = null;
    }
    if (cachedEngine) {
      dispatch({ type: "loaded", engine: cachedEngine });
      return;
    }
    dispatch({ type: "loading" });
    preloadPdfiumEngine().then((engine) => {
      if (isActive) dispatch({ type: "loaded", engine });
    }, (error) => {
      if (!isActive) return;
      dispatch({ type: "error", error, reason: error instanceof PdfiumEngineTimeoutError ? "engine_timeout" : "engine_error" });
    });
    return () => { isActive = false; };
  }, [retryKey]);

  return state;
}
