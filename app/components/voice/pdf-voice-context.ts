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

// Every mounted viewer, ordered by its latest update. The most recently
// updated viewer is the active one; when it closes, the next one takes over.
const openPdfSnapshots = new Map<string, ActivePdfSnapshot>();

export function getActivePdfSnapshot() {
  let active: ActivePdfSnapshot | null = null;
  for (const snapshot of openPdfSnapshots.values()) active = snapshot;
  return active;
}

export function setActivePdfSnapshot(nextSnapshot: ActivePdfSnapshot) {
  openPdfSnapshots.delete(nextSnapshot.viewerId);
  openPdfSnapshots.set(nextSnapshot.viewerId, nextSnapshot);
}

export function clearActivePdfSnapshot(viewerId: string) {
  openPdfSnapshots.delete(viewerId);
}
