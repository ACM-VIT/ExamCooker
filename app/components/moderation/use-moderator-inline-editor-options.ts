"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { getModeratorInlineEditorOptions } from "@/app/actions/get-moderator-inline-editor-options";
import type { CourseOption } from "@/app/components/mod/course-picker";

type ModeratorInlineEditorOptions = {
  courses: CourseOption[];
  tags: string[];
};

let cachedOptions: ModeratorInlineEditorOptions | null | undefined;
let optionsPromise: Promise<ModeratorInlineEditorOptions> | null = null;

type ModeratorInlineEditorOptionsState = {
  options: ModeratorInlineEditorOptions | null;
  error: string | null;
  isLoading: boolean;
};

type ModeratorInlineEditorOptionsAction =
  | { type: "loading" }
  | { type: "loaded"; options: ModeratorInlineEditorOptions }
  | { type: "failed"; message: string };

function getInitialOptionsState(enabled: boolean): ModeratorInlineEditorOptionsState {
  return {
    options: cachedOptions ?? null,
    error: null,
    isLoading: enabled && !cachedOptions,
  };
}

function moderatorInlineEditorOptionsReducer(
  state: ModeratorInlineEditorOptionsState,
  action: ModeratorInlineEditorOptionsAction,
): ModeratorInlineEditorOptionsState {
  switch (action.type) {
    case "loading":
      return { ...state, isLoading: true };
    case "loaded":
      return {
        options: action.options,
        error: null,
        isLoading: false,
      };
    case "failed":
      return { ...state, error: action.message, isLoading: false };
    default:
      return state;
  }
}

function loadOptions() {
  if (cachedOptions) {
    return Promise.resolve(cachedOptions);
  }

  if (!optionsPromise) {
    optionsPromise = getModeratorInlineEditorOptions()
      .then((options) => {
        cachedOptions = options;
        return options;
      })
      .finally(() => {
        optionsPromise = null;
      });
  }

  return optionsPromise;
}

export function useModeratorInlineEditorOptions(enabled: boolean) {
  const [{ error, isLoading, options }, dispatch] = useReducer(
    moderatorInlineEditorOptionsReducer,
    enabled,
    getInitialOptionsState,
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const replaceOptions = useCallback((nextOptions: ModeratorInlineEditorOptions) => {
    optionsRef.current = nextOptions;
    cachedOptions = nextOptions;
    dispatch({ type: "loaded", options: nextOptions });
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (cachedOptions) {
      replaceOptions(cachedOptions);
      return;
    }

    let cancelled = false;
    dispatch({ type: "loading" });

    void loadOptions()
      .then((nextOptions) => {
        if (cancelled) {
          return;
        }

        replaceOptions(nextOptions);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        dispatch({
          type: "failed",
          message:
            loadError instanceof Error
              ? loadError.message
              : "Failed to load moderator editor options.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, replaceOptions]);

  return {
    courses: options?.courses ?? [],
    tags: options?.tags ?? [],
    error,
    isLoading,
    setCourses: (
      nextCourses:
        | CourseOption[]
        | ((currentCourses: CourseOption[]) => CourseOption[]),
    ) => {
      const currentOptions = optionsRef.current;
      const currentCourses = currentOptions?.courses ?? [];
      const courses =
        typeof nextCourses === "function"
          ? nextCourses(currentCourses)
          : nextCourses;

      replaceOptions({
        courses,
        tags: currentOptions?.tags ?? [],
      });
    },
    setTags: (
      nextTags: string[] | ((currentTags: string[]) => string[]),
    ) => {
      const currentOptions = optionsRef.current;
      const currentTags = currentOptions?.tags ?? [];
      const tags =
        typeof nextTags === "function" ? nextTags(currentTags) : nextTags;

      replaceOptions({
        courses: currentOptions?.courses ?? [],
        tags,
      });
    },
  };
}
