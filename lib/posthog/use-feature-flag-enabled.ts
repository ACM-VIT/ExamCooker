"use client";

import { useEffect, useState } from "react";
import { initializePostHogClient } from "@/lib/posthog/client";

export function usePostHogFeatureFlagEnabled(flag: string) {
    const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        void initializePostHogClient()
            .then((posthog) => {
                if (cancelled) return;

                if (!posthog) {
                    setEnabled(false);
                    return;
                }

                setEnabled(posthog.isFeatureEnabled(flag, { send_event: false }) === true);
                unsubscribe = posthog.onFeatureFlags(() => {
                    setEnabled(posthog.isFeatureEnabled(flag, { send_event: false }) === true);
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
