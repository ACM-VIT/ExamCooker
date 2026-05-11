"use client";

import dynamic from "next/dynamic";

export const LazyNoteInlineEditor = dynamic(
  () => import("@/app/components/moderation/note-inline-editor"),
  { ssr: false },
);

export const LazyPastPaperInlineEditor = dynamic(
  () => import("@/app/components/moderation/past-paper-inline-editor"),
  { ssr: false },
);

export const LazyPastPaperPageEditor = dynamic(
  () => import("@/app/components/moderation/past-paper-page-editor"),
  { ssr: false },
);

export const LazySyllabusInlineEditor = dynamic(
  () => import("@/app/components/moderation/syllabus-inline-editor"),
  { ssr: false },
);
