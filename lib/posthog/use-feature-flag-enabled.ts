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

export function usePostHogFeatureFlagEnabled(flag: string) {
    const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

	useEffect(() => {
		let cancelled = false;
		let unsubscribe: (() => void) | undefined;
        let cancelScheduledLoad: (() => void) | undefined;

        const loadFeatureFlag = () => {
            void initializePostHogClient()
                .then((posthog) => {
                    if (cancelled) return;

                    const readFlag = () =>
                        posthog?.isFeatureEnabled(flag, { send_event: false }) === true;

                    setEnabled(readFlag());
                    unsubscribe = posthog?.onFeatureFlags(() => {
                        setEnabled(readFlag());
                    });
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

    return enabled;
}
