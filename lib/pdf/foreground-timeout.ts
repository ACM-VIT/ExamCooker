// Browsers suspend rendering and throttle timers in hidden tabs. A watchdog
// should measure time the user could actually see progress, not time away.
export function foregroundTimeout(callback: () => void, delayMs: number) {
  const visibility = typeof document === "undefined" ? null : document;
  let remaining = delayMs;
  let started = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const pause = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    remaining = Math.max(0, remaining - (Date.now() - started));
  };
  const cancel = () => {
    cancelled = true;
    pause();
    visibility?.removeEventListener("visibilitychange", update);
  };
  const update = () => {
    if (cancelled) return;
    if (visibility?.visibilityState === "hidden") {
      pause();
    } else if (timer === undefined) {
      started = Date.now();
      timer = setTimeout(() => {
        if (visibility?.visibilityState === "hidden") { pause(); return; }
        cancel();
        callback();
      }, remaining);
    }
  };
  visibility?.addEventListener("visibilitychange", update);
  update();
  return cancel;
}
