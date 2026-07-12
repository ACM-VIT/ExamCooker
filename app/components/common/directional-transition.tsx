"use client";

import React, { ViewTransition, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// `<ViewTransition>` is an experimental React API. On interrupted navigations it
// can read `_retryCache` off a null Offscreen instance and throw an unhandled
// `TypeError` when `<Suspense>` boundaries are torn down mid-transition (which they
// are on every app route, since pages nest Suspense inside this keyed transition).
// Keep it behind an opt-in flag so we can validate the experimental path before
// enabling it broadly; when disabled we render children directly with no animation.
function pageViewTransitionsEnabled() {
    return process.env.NEXT_PUBLIC_ENABLE_VIEW_TRANSITIONS === "true";
}

function hasNativeShellAttributes() {
    if (typeof document === "undefined") return false;
    const root = document.documentElement;
    return (
        root.hasAttribute("data-native-platform") ||
        root.hasAttribute("data-native-android") ||
        root.hasAttribute("data-native-ios")
    );
}

function useDisablePageViewTransitions() {
    const [disabled, setDisabled] = useState(false);

    useEffect(() => {
        const root = document.documentElement;
        const sync = () => setDisabled(hasNativeShellAttributes());

        sync();
        const observer = new MutationObserver(sync);
        observer.observe(root, {
            attributes: true,
            attributeFilter: ["data-native-platform", "data-native-android", "data-native-ios"],
        });

        return () => observer.disconnect();
    }, []);

    return disabled;
}

export default function DirectionalTransition({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const disablePageViewTransitions = useDisablePageViewTransitions();

    if (!pageViewTransitionsEnabled() || disablePageViewTransitions) {
        return <>{children}</>;
    }

    return (
        <ViewTransition
            key={pathname}
            enter={{
                "nav-forward": "nav-forward",
                "nav-back": "nav-back",
                "nav-lateral": "nav-lateral-enter",
                default: "none",
            }}
            exit={{
                "nav-forward": "nav-forward",
                "nav-back": "nav-back",
                "nav-lateral": "nav-lateral-exit",
                default: "none",
            }}
            default="none"
        >
            {children}
        </ViewTransition>
    );
}
