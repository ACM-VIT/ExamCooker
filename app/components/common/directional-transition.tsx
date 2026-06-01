"use client";

import React, { ViewTransition, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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

    if (disablePageViewTransitions) {
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
