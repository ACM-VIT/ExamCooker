"use client";

export type ActivePdfSnapshot = {
  currentPage: number;
  fileName: string;
  fileUrl: string;
  navigateToPage: (pageNumber: number) => void;
  title: string;
  totalPages: number;
  viewerId: string;
};

let activePdfSnapshot: ActivePdfSnapshot | null = null;

export function getActivePdfSnapshot() {
  return activePdfSnapshot;
}

export function setActivePdfSnapshot(nextSnapshot: ActivePdfSnapshot) {
  activePdfSnapshot = nextSnapshot;
}

export function clearActivePdfSnapshot(viewerId: string) {
  if (activePdfSnapshot?.viewerId === viewerId) {
    activePdfSnapshot = null;
  }
}
