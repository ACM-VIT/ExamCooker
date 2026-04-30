"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";

export function usePostHogFeatureFlagEnabled(flag: string) {
    const [enabled, setEnabled] = useState<boolean | undefined>(() =>
        posthog.isFeatureEnabled(flag, { send_event: false }),
    );

    useEffect(() => {
        setEnabled(posthog.isFeatureEnabled(flag, { send_event: false }));

        return posthog.onFeatureFlags(() => {
            setEnabled(posthog.isFeatureEnabled(flag, { send_event: false }));
        });
    }, [flag]);

    return enabled;
}
