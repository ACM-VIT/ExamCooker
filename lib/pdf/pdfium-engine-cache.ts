"use client";

import { useEffect, useReducer } from "react";

export const PDFIUM_WASM_URL = "/vendor/embedpdf/pdfium.wasm";

type PdfiumEngine = Awaited<
  ReturnType<
    typeof import("@embedpdf/engines/pdfium-direct-engine").createPdfiumEngine
  >
>;

type PdfiumEngineState =
  | { status: "loading"; engine: null; error: null }
  | { status: "loaded"; engine: PdfiumEngine; error: null }
  | { status: "error"; engine: null; error: unknown };

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
  | { type: "error"; error: unknown };

function getInitialPdfiumEngineState(): PdfiumEngineState {
  if (cachedEngine) {
    return { status: "loaded", engine: cachedEngine, error: null };
  }

  if (cachedError) {
    return { status: "error", engine: null, error: cachedError };
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
      return { status: "error", engine: null, error: action.error };
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

    if (!cachedEngine) {
      dispatch({ type: "loading" });
    }

    preloadPdfiumEngine()
      .then((engine) => {
        if (!isActive) return;
        dispatch({ type: "loaded", engine });
      })
      .catch((error) => {
        if (!isActive) return;
        dispatch({ type: "error", error });
      });

    return () => {
      isActive = false;
    };
  }, [retryKey]);

  return state;
}
