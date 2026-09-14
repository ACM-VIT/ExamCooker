"use client";

import { useLayoutEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

/** Adopt edits made to the server-rendered input before React attaches events. */
export function usePreserveSearchInput(
  inputRef: RefObject<HTMLInputElement | null>,
  setQuery: Dispatch<SetStateAction<string>>,
  setIsOpen: Dispatch<SetStateAction<boolean>>,
) {
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // React preserves the DOM value during hydration, but a later controlled
    // render would replace it with the initial state unless we adopt it now.
    setQuery(input.value);
    if (document.activeElement === input) setIsOpen(true);
  }, [inputRef, setQuery, setIsOpen]);
}
