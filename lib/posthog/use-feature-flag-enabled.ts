"use client";

import { useEffect, useState } from "react";
import { initializePostHogClient } from "@/lib/posthog/client";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

function isNativeRuntime() {
    if (typeof window === "undefined") return false;

    const root = document.documentElement;
    if (
        root.hasAttribute("data-native-platform") ||
        root.hasAttribute("data-native-android") ||
        root.hasAttribute("data-native-ios")
    ) {
        return true;
    }

    const capacitor = (window as Window & {
        Capacitor?: { isNativePlatform?: () => boolean };
    }).Capacitor;

    try {
        return capacitor?.isNativePlatform?.() === true;
    } catch {
        return false;
    }
}

// undefined until the flag's value is known. The value is tied to the flag
// it was read for, so switching flags never reports the previous flag's value.
type FlagState = { flag: string; enabled: boolean | undefined };

export function usePostHogFeatureFlagEnabled(flag: string) {
    const [state, setState] = useState<FlagState>({ flag, enabled: undefined });

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        let cancelScheduledLoad: (() => void) | undefined;

        const loadFeatureFlag = () => {
            void initializePostHogClient()
                .then((posthog) => {
                    if (cancelled) return;

                    const readFlag = () => {
                        if (!posthog) {
                            setState({ flag, enabled: false });
                            return;
                        }
                        // undefined means flags are not loaded (or failed to
                        // reload). Keep the last known value rather than
                        // flipping to false, which would unmount gated UI.
                        const value = posthog.isFeatureEnabled(flag, { send_event: false });
                        if (value === undefined) return;
                        setState((current) =>
                            current.flag === flag && current.enabled === value
                                ? current
                                : { flag, enabled: value },
                        );
                    };

                    readFlag();
                    unsubscribe = posthog?.onFeatureFlags(readFlag);
                })
                .catch(() => undefined);
        };

        if (isNativeRuntime()) {
            cancelScheduledLoad = scheduleIdleWork(loadFeatureFlag, {
                fallbackDelayMs: 3500,
                timeoutMs: 6000,
            });
        } else {
            loadFeatureFlag();
        }

        return () => {
            cancelled = true;
            cancelScheduledLoad?.();
            unsubscribe?.();
        };
    }, [flag]);

    return state.flag === flag ? state.enabled : undefined;
}
