"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef, useState } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { PdfErrorCode, Rotation } from "@embedpdf/models";
import { useRenderCapability } from "@embedpdf/plugin-render/react";
import type { PdfPageRotation } from "@/lib/pdf/page-edits";
import { foregroundTimeout } from "@/lib/pdf/foreground-timeout";
import { getEffectivePdfRotation } from "@/lib/pdf/render-rotation";

const THUMB_SCALE = 0.22;
const THUMB_RENDER_TIMEOUT_MS = 20_000;

function toRotationEnum(rotation: PdfPageRotation): Rotation {
  switch (rotation) {
    case 90:
      return Rotation.Degree90;
    case 180:
      return Rotation.Degree180;
    case 270:
      return Rotation.Degree270;
    case 0:
      return Rotation.Degree0;
    default:
      return Rotation.Degree0;
  }
}

type PdfPageThumbnailProps = {
  documentId: string;
  pageIndex: number;
  rotation: PdfPageRotation;
};

type PreviewState =
  | { status: "loading"; imageUrl: null }
  | { status: "ready"; imageUrl: string }
  | { status: "error"; imageUrl: null };

type PreviewAction =
  | { type: "loading" }
  | { type: "ready"; imageUrl: string }
  | { type: "error" };

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case "loading":
      return state.status === "loading" ? state : { status: "loading", imageUrl: null };
    case "ready":
      return { status: "ready", imageUrl: action.imageUrl };
    case "error":
      return { status: "error", imageUrl: null };
  }
}

/**
 * Compact PDF page preview rendered through the same EmbedPDF render
 * pipeline used by the main viewer. Renders the page pre-rotated so the
 * resulting bitmap already reflects the moderator's pending fixes.
 */
export default function PdfPageThumbnail({
  documentId,
  pageIndex,
  rotation,
}: PdfPageThumbnailProps) {
  const { provides: renderProvides } = useRenderCapability();
  const documentState = useDocumentState(documentId);
  const renderRotation = getEffectivePdfRotation(
    documentState?.document?.pages[pageIndex]?.rotation,
    toRotationEnum(rotation),
  );
  const [previewState, dispatchPreview] = useReducer(previewReducer, {
    status: "loading",
    imageUrl: null,
  });
  const imageUrlRef = useRef<string | null>(null);
  // A failed thumbnail is rendered once more. It sits inside the page's jump
  // button, so it cannot offer its own retry control.
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!renderProvides || documentState?.status !== "loaded") {
      return;
    }

    let cancelled = false;
    let didSettle = false;
    dispatchPreview({ type: "loading" });
    const abortTask = (message: string) => {
      try {
        task.abort({ code: PdfErrorCode.Cancelled, message });
      } catch {
        // Aborting is best-effort; cleanup should not throw during unmount.
      }
    };

    const task = renderProvides.forDocument(documentId).renderPage({
      pageIndex,
      options: {
        scaleFactor: THUMB_SCALE,
        rotation: renderRotation,
        dpr: 1,
      },
    });

    const fail = () => {
      didSettle = true;
      if (retryVersion === 0) setRetryVersion(1);
      else dispatchPreview({ type: "error" });
    };
    // A hung render would otherwise leave the placeholder pulsing forever.
    const cancelTimeout = foregroundTimeout(() => {
      if (cancelled || didSettle) return;
      abortTask("Thumbnail render timed out");
      fail();
    }, THUMB_RENDER_TIMEOUT_MS);

    task
      .toPromise()
      .then((blob) => {
        if (cancelled || didSettle) return;
        if (!blob || blob.size === 0) {
          fail();
          return;
        }
        didSettle = true;
        const nextImageUrl = URL.createObjectURL(blob);
        if (imageUrlRef.current) {
          URL.revokeObjectURL(imageUrlRef.current);
        }
        imageUrlRef.current = nextImageUrl;
        dispatchPreview({ type: "ready", imageUrl: nextImageUrl });
      })
      .catch(() => {
        if (cancelled || didSettle) return;
        fail();
      })
      .finally(cancelTimeout);

    return () => {
      cancelled = true;
      cancelTimeout();
      if (!didSettle) abortTask("Thumbnail render cancelled");
    };
  }, [documentId, documentState?.status, pageIndex, renderProvides, renderRotation, retryVersion]);

  useEffect(
    () => () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    },
    [],
  );

  if (previewState.status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/35">
        <span>Page {pageIndex + 1}</span>
        <span>preview unavailable</span>
      </div>
    );
  }

  if (previewState.status !== "ready") {
    return (
      <div className="h-full w-full animate-pulse bg-black/5 dark:bg-white/5" />
    );
  }

  return (
    <div className="relative h-full w-full">
    <Image
      alt={`Source page ${pageIndex + 1} preview`}
      src={previewState.imageUrl}
      fill
      unoptimized
      sizes="12rem"
      className="select-none object-contain"
      draggable={false}
    />
    </div>
  );
}
