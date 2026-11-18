"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { useSyncExternalStore } from "react";

export type NativeCourseSearchCourse = {
  code: string;
  title: string;
  paperCount: number;
  noteCount: number;
  syllabusId?: string | null;
  aliases?: string[];
};

export type NativeCourseSearchResult =
  | {
      action: "select";
      courseCode: string;
      resultCount: number;
      resultIndex: number;
    }
  | {
      action: "submit";
      query: string;
      resultCount: number;
      exactCourseCode?: string;
    }
  | {
      action: "cancel";
    };

type NativeCourseSearchOptions = {
  title: string;
  placeholder: string;
  initialQuery?: string;
  darkMode?: boolean;
  courses: NativeCourseSearchCourse[];
};

type NativeCourseSearchPlugin = {
  present(options: NativeCourseSearchOptions): Promise<NativeCourseSearchResult>;
};

const NativeCourseSearch =
  registerPlugin<NativeCourseSearchPlugin>("NativeCourseSearch", {
    ios: {
      present(options: NativeCourseSearchOptions) {
        const nativePromise = (
          Capacitor as typeof Capacitor & {
            nativePromise?: <T>(
              pluginName: string,
              methodName: string,
              options?: unknown,
            ) => Promise<T>;
          }
        ).nativePromise;

        if (!nativePromise) {
          return Promise.reject(
            new Error("Native course search bridge is unavailable"),
          );
        }

        return nativePromise<NativeCourseSearchResult>(
          "NativeCourseSearch",
          "present",
          options,
        );
      },
    },
  });

export function canUseNativeCourseSearch() {
  return (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios"
  );
}

function subscribeToNativeCourseSearchAvailability(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("focus", onStoreChange);
  document.addEventListener("visibilitychange", onStoreChange);

  return () => {
    window.removeEventListener("focus", onStoreChange);
    document.removeEventListener("visibilitychange", onStoreChange);
  };
}

function getNativeCourseSearchAvailabilitySnapshot() {
  return canUseNativeCourseSearch();
}

function getServerNativeCourseSearchAvailabilitySnapshot() {
  return false;
}

export function useNativeCourseSearchAvailable() {
  return useSyncExternalStore(
    subscribeToNativeCourseSearchAvailability,
    getNativeCourseSearchAvailabilitySnapshot,
    getServerNativeCourseSearchAvailabilitySnapshot,
  );
}

// A second tap this soon after the first is the same gesture, not a new request.
const DOUBLE_TAP_WINDOW_MS = 1000;

/**
 * Wraps presentations so a call made while the previous one is still pending
 * and inside the double-tap window resolves with `duplicate` instead of
 * starting another. Once a presentation settles, or the window passes, the
 * next call starts a new one. Times come from a monotonic clock, so a wall
 * clock change cannot stretch the window.
 */
export function createDoubleTapGuard<T>(
  duplicate: T,
  now: () => number = () => performance.now(),
) {
  let pending: { startedAt: number } | null = null;

  return (start: () => Promise<T>): Promise<T> => {
    const startedAt = now();
    if (pending && startedAt - pending.startedAt < DOUBLE_TAP_WINDOW_MS) {
      return Promise.resolve(duplicate);
    }

    const marker = { startedAt };
    pending = marker;
    // An older presentation settling must not clear a newer one's marker.
    const settle = () => {
      if (pending === marker) pending = null;
    };

    let presentation: Promise<T>;
    try {
      presentation = start();
    } catch (error) {
      settle();
      throw error;
    }
    presentation.then(settle, settle);
    return presentation;
  };
}

const guardNativeCourseSearch = createDoubleTapGuard<NativeCourseSearchResult>(
  { action: "cancel" },
);

/**
 * Presents the native course search. A second call while the first is still
 * pending and just made (a double tap) is answered as a cancel, so its caller
 * does nothing instead of being rejected as "already open" and switching to
 * the web input.
 *
 * Later calls always reach the native side. If it still believes a sheet is
 * open (one that was swiped away never reports back), it rejects, and the
 * caller falls back to the web input rather than doing nothing.
 */
export function presentNativeCourseSearch(
  options: NativeCourseSearchOptions,
): Promise<NativeCourseSearchResult> {
  return guardNativeCourseSearch(() => {
    const root = document.documentElement;
    const explicitTheme = root.dataset.theme;
    const inferredDarkMode =
      explicitTheme === "dark" ||
      (explicitTheme !== "light" &&
        (root.classList.contains("dark") ||
          root.style.colorScheme.includes("dark") ||
          window.matchMedia("(prefers-color-scheme: dark)").matches));

    return NativeCourseSearch.present({
      ...options,
      darkMode: options.darkMode ?? inferredDarkMode,
    });
  });
}
