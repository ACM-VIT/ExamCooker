"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

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

export function presentNativeCourseSearch(options: NativeCourseSearchOptions) {
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
}
