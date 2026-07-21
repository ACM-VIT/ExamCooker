"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { PdfErrorCode, Rotation } from "@embedpdf/models";
import { useRenderCapability } from "@embedpdf/plugin-render/react";
import type { PdfPageRotation } from "@/lib/pdf/page-edits";

const THUMB_SCALE = 0.22;

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
  const [previewState, dispatchPreview] = useReducer(previewReducer, {
    status: "loading",
    imageUrl: null,
  });
  const imageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!renderProvides || documentState?.status !== "loaded") {
      return;
    }

    let cancelled = false;
    let didSettle = false;
    dispatchPreview({ type: "loading" });

    const task = renderProvides.forDocument(documentId).renderPage({
      pageIndex,
      options: {
        scaleFactor: THUMB_SCALE,
        rotation: toRotationEnum(rotation),
        dpr: 1,
      },
    });

    task
      .toPromise()
      .then((blob) => {
        if (cancelled) return;
        didSettle = true;
        const nextImageUrl = URL.createObjectURL(blob);
        if (imageUrlRef.current) {
          URL.revokeObjectURL(imageUrlRef.current);
        }
        imageUrlRef.current = nextImageUrl;
        dispatchPreview({ type: "ready", imageUrl: nextImageUrl });
      })
      .catch(() => {
        if (cancelled) return;
        didSettle = true;
        dispatchPreview({ type: "error" });
      });

    return () => {
      cancelled = true;
      if (!didSettle) {
        try {
          task.abort({
            code: PdfErrorCode.Cancelled,
            message: "Thumbnail render cancelled",
          });
        } catch {
          // Aborting is best-effort; cleanup should not throw during unmount.
        }
      }
    };
  }, [documentId, documentState?.status, pageIndex, renderProvides, rotation]);

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
