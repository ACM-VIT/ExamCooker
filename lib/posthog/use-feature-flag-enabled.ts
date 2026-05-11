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

				const readFlag = () =>
					posthog?.isFeatureEnabled(flag, { send_event: false }) === true;

				setEnabled(readFlag());
				unsubscribe = posthog?.onFeatureFlags(() => {
					setEnabled(readFlag());
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
