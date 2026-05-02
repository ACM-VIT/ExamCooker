"use client";

import { useEffect, useState } from "react";

export function usePostHogFeatureFlagEnabled(flag: string) {
    const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        void import("posthog-js")
            .then((module) => {
                if (cancelled) return;
                const posthog = module.default;
                setEnabled(posthog.isFeatureEnabled(flag, { send_event: false }));
                unsubscribe = posthog.onFeatureFlags(() => {
                    setEnabled(posthog.isFeatureEnabled(flag, { send_event: false }));
                });
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [flag]);

    return enabled;
}
