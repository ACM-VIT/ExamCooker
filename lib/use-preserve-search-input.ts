"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Adopt edits made to the server-rendered input before React attaches events. */
export function usePreserveSearchInput(
  inputRef: RefObject<HTMLInputElement | null>,
  setQuery: (value: string) => void,
  setIsOpen?: (value: boolean) => void,
) {
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // Keep the first render's results consistent with the server HTML, then
    // adopt the live value before another controlled render can overwrite it.
    setQuery(input.value);
    if (document.activeElement === input) setIsOpen?.(true);
  }, [inputRef, setQuery, setIsOpen]);
}
