"use client";

import { useEffect, useState } from "react";

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

export function usePreloadedPdfiumEngine(retryKey = 0): PdfiumEngineState {
  const [state, setState] = useState<PdfiumEngineState>(() => {
    if (cachedEngine) {
      return { status: "loaded", engine: cachedEngine, error: null };
    }

    if (cachedError) {
      return { status: "error", engine: null, error: cachedError };
    }

    return { status: "loading", engine: null, error: null };
  });

  useEffect(() => {
    let isActive = true;

    if (!cachedEngine) {
      setState({ status: "loading", engine: null, error: null });
    }

    preloadPdfiumEngine()
      .then((engine) => {
        if (!isActive) return;
        setState({ status: "loaded", engine, error: null });
      })
      .catch((error) => {
        if (!isActive) return;
        setState({ status: "error", engine: null, error });
      });

    return () => {
      isActive = false;
    };
  }, [retryKey]);

  return state;
}
