import React from "react";

type ReactWithTransitionTypes = typeof React & {
    addTransitionType?: (transitionType: string) => void;
};

/**
 * Next 16.3 can emit navigations tagged with React transition types, but the
 * pinned React 19.2 runtime does not expose `addTransitionType` yet. Install a
 * no-op fallback so those navigations still run instead of throwing before push.
 */
export function installReactTransitionTypeFallback() {
    const reactWithTransitionTypes = React as ReactWithTransitionTypes;

    if (typeof reactWithTransitionTypes.addTransitionType === "function") {
        return "native" as const;
    }

    reactWithTransitionTypes.addTransitionType = () => undefined;
    return "fallback" as const;
}
