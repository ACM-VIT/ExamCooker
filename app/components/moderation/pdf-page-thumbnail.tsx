"use client";

import { useEffect, useRef, useState } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { Rotation } from "@embedpdf/models";
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const imageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!renderProvides || documentState?.status !== "loaded") {
      return;
    }

    let cancelled = false;
    setHasError(false);

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
        const nextImageUrl = URL.createObjectURL(blob);
        if (imageUrlRef.current) {
          URL.revokeObjectURL(imageUrlRef.current);
        }
        imageUrlRef.current = nextImageUrl;
        setImageUrl(nextImageUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
      });

    return () => {
      cancelled = true;
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

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/35">
        <span>Page {pageIndex + 1}</span>
        <span>preview unavailable</span>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="h-full w-full animate-pulse bg-black/5 dark:bg-white/5" />
    );
  }

  return (
    <img
      alt={`Source page ${pageIndex + 1} preview`}
      src={imageUrl}
      className="h-full w-full select-none object-contain"
      draggable={false}
    />
  );
}
