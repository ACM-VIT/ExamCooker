type IdleWorkOptions = {
    fallbackDelayMs: number;
    timeoutMs: number;
};

export function scheduleIdleWork(
    callback: () => void,
    { fallbackDelayMs, timeoutMs }: IdleWorkOptions,
) {
    if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(callback, { timeout: timeoutMs });
        return () => window.cancelIdleCallback(id);
    }

    const id = globalThis.setTimeout(callback, fallbackDelayMs);
    return () => globalThis.clearTimeout(id);
}
