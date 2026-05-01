"use client";

import React, {
    createContext,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
    describePathForBreadcrumb,
    mergePrevCrumb,
    normalizeRouteKey,
    type BreadcrumbNavItem,
} from "@/lib/breadcrumb-nav";

const NavFromRawContext = createContext<string | null>(null);

function NavFromProviderInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "";
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const full = `${pathname}${search ? `?${search}` : ""}`;
    const currentRef = useRef<string | null>(null);
    const [fromPath, setFromPath] = useState<string | null>(null);

    useLayoutEffect(() => {
        const prev = currentRef.current;
        if (prev === null) {
            let boot: string | null = null;
            try {
                if (typeof document !== "undefined" && document.referrer) {
                    const u = new URL(document.referrer);
                    if (u.origin === window.location.origin) {
                        const rp = `${u.pathname}${u.search ?? ""}`;
                        if (rp && normalizeRouteKey(rp) !== normalizeRouteKey(full)) {
                            boot = rp;
                        }
                    }
                }
            } catch {
                // ignore
            }
            currentRef.current = full;
            setFromPath(boot);
            return;
        }

        if (normalizeRouteKey(prev) !== normalizeRouteKey(full)) {
            currentRef.current = full;
            setFromPath(prev);
        }
    }, [full]);

    return (
        <NavFromRawContext.Provider value={fromPath}>{children}</NavFromRawContext.Provider>
    );
}

export function NavFromProvider({ children }: { children: React.ReactNode }) {
    return <NavFromProviderInner>{children}</NavFromProviderInner>;
}

export function useNavFromRawPath(): string | null {
    return useContext(NavFromRawContext);
}

export function useNavFromBreadcrumbItem(): { label: string; href: string } | null {
    const raw = useNavFromRawPath();
    const pathname = usePathname() ?? "";
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const current = `${pathname}${search ? `?${search}` : ""}`;

    return useMemo(() => {
        if (!raw) return null;
        if (normalizeRouteKey(raw) === normalizeRouteKey(current)) return null;
        return describePathForBreadcrumb(raw);
    }, [raw, current]);
}

export function useMergedBreadcrumbItems(items: BreadcrumbNavItem[]): BreadcrumbNavItem[] {
    const prev = useNavFromBreadcrumbItem();
    const pathname = usePathname() ?? "";
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const current = `${pathname}${search ? `?${search}` : ""}`;

    return useMemo(
        () => mergePrevCrumb(prev, items, current),
        [prev, items, current],
    );
}
