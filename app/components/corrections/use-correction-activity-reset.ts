import { useLayoutEffect, type Dispatch, type SetStateAction } from "react";

export function useCorrectionActivityReset(
  setAwaitingSession: Dispatch<SetStateAction<boolean>>,
) {
  useLayoutEffect(
    () => () => setAwaitingSession(false),
    [setAwaitingSession],
  );
}
