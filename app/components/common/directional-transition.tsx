"use client";

import React, { useEffect, useState } from "react";
import type { ViewTransitionClass } from "react";
import { OptionalViewTransition } from "./optional-view-transition";

// `<ViewTransition>` is an experimental React API. It used to be keyed on
// `pathname`, which forced the whole page subtree to remount on every
// navigation. Because pages stream their content behind nested `<Suspense>`
// boundaries, interrupting a navigation tore down the exit-side Offscreen
// instance while a suspended resource was still pending — React's retry path
// then read `_retryCache` off a null Offscreen `stateNode` and threw an
// unhandled `TypeError`.
//
// The directional animation never depended on that key: the forward / back /
// lateral direction comes from React transition *types* (`transitionTypes` on
// `<Link>` and `addTransitionType(...)` on programmatic navigations), which are
// mapped to CSS classes below. So we keep a single, persistent `<ViewTransition>`
// (no `key`) that is never remounted, and animate route changes through the
// `update` path instead of key-driven enter/exit. Suspense boundaries are no
// longer torn down mid-transition, which removes the crash at its root.

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

// Transition-type → CSS class mappings, shared by the enter (first mount) and
// update (route-to-route) paths so both play the same directional animation.
const NAV_TRANSITION_CLASSES: ViewTransitionClass = {
    "nav-forward": "nav-forward",
    "nav-back": "nav-back",
    "nav-lateral": "nav-lateral",
    default: "none",
};

export default function DirectionalTransition({
    children,
}: {
    children: React.ReactNode;
}) {
    const disablePageViewTransitions = useDisablePageViewTransitions();

    if (disablePageViewTransitions) {
        return <>{children}</>;
    }

    return (
        <OptionalViewTransition
            enter={NAV_TRANSITION_CLASSES}
            update={NAV_TRANSITION_CLASSES}
            default="none"
        >
            {children}
        </OptionalViewTransition>
    );
}
