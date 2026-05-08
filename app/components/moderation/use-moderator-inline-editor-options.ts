"use client";

import { useEffect, useState } from "react";
import { getModeratorInlineEditorOptions } from "@/app/actions/get-moderator-inline-editor-options";
import type { CourseOption } from "@/app/components/mod/course-picker";

type ModeratorInlineEditorOptions = {
  courses: CourseOption[];
  tags: string[];
};

let cachedOptions: ModeratorInlineEditorOptions | null | undefined;
let optionsPromise: Promise<ModeratorInlineEditorOptions> | null = null;

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
  const [options, setOptions] = useState<ModeratorInlineEditorOptions | null>(
    cachedOptions ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !cachedOptions);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (cachedOptions) {
      setOptions(cachedOptions);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void loadOptions()
      .then((nextOptions) => {
        if (cancelled) {
          return;
        }

        setOptions(nextOptions);
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load moderator editor options.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

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
      setOptions((currentOptions) => {
        const currentCourses = currentOptions?.courses ?? [];
        const courses =
          typeof nextCourses === "function"
            ? nextCourses(currentCourses)
            : nextCourses;

        const nextOptions = {
          courses,
          tags: currentOptions?.tags ?? [],
        };
        cachedOptions = nextOptions;
        return nextOptions;
      });
    },
    setTags: (
      nextTags: string[] | ((currentTags: string[]) => string[]),
    ) => {
      setOptions((currentOptions) => {
        const currentTags = currentOptions?.tags ?? [];
        const tags =
          typeof nextTags === "function" ? nextTags(currentTags) : nextTags;

        const nextOptions = {
          courses: currentOptions?.courses ?? [],
          tags,
        };
        cachedOptions = nextOptions;
        return nextOptions;
      });
    },
  };
}
