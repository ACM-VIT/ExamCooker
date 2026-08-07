"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { useIsMobile } from "@/app/components/ui/use-is-mobile";

const ANDROID_INSTALL_BANNER_STORAGE_KEY = "examcooker.androidInstallBanner.v1";
const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=in.acmvit.examcooker";

function isAndroidBrowser() {
    if (typeof navigator === "undefined") return false;
    const userAgent = navigator.userAgent || "";
    return /Android/i.test(userAgent);
}

function hasDismissedBanner() {
    if (typeof window === "undefined") return true;
    try {
        return window.localStorage.getItem(ANDROID_INSTALL_BANNER_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function dismissBanner() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(ANDROID_INSTALL_BANNER_STORAGE_KEY, "1");
    } catch {
        /* storage may be unavailable */
    }
}

async function hasInstalledRelatedApp() {
    if (typeof navigator === "undefined") return false;

    const relatedAppsGetter = (
        navigator as Navigator & {
            getInstalledRelatedApps?: () => Promise<Array<{ id?: string }>>;
        }
    ).getInstalledRelatedApps;

    if (!relatedAppsGetter) return false;

    try {
        const relatedApps = await relatedAppsGetter.call(navigator);
        return relatedApps.some((app) => app.id === "in.acmvit.examcooker");
    } catch {
        return false;
    }
}

export default function AndroidInstallBanner() {
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const [shouldShow, setShouldShow] = useState(false);

    const isUtilityPage = pathname === "/cli" || pathname.startsWith("/mod");
    const isAuthPage = pathname === "/auth";

    useEffect(() => {
        let cancelled = false;

        async function checkEligibility() {
            let nextShouldShow = false;

            if (!isMobile || isUtilityPage || isAuthPage || !isAndroidBrowser()) {
                return nextShouldShow;
            }

            const { Capacitor } = await import("@capacitor/core");
            if (cancelled) return;

            if (!Capacitor.isNativePlatform() && !hasDismissedBanner()) {
                nextShouldShow = !(await hasInstalledRelatedApp());
            }

            return nextShouldShow;
        }

        void checkEligibility()
            .then((nextShouldShow) => {
                if (!cancelled) {
                    setShouldShow(Boolean(nextShouldShow));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setShouldShow(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthPage, isUtilityPage, isMobile]);

    if (!shouldShow) return null;

    const handleDismiss = () => {
        dismissBanner();
        setShouldShow(false);
    };

    const handleInstallClick = () => {
        dismissBanner();
        setShouldShow(false);
    };

    return (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-50 px-3 pb-3 md:hidden">
            <div className="mx-auto flex max-w-md items-center gap-3 border-2 border-black bg-white p-3 text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.18)] dark:border-white/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                <Image
                    src="/icons/icon-192.png"
                    alt=""
                    width={42}
                    height={42}
                    className="size-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold leading-tight">
                        <span className="min-[380px]:hidden">Install</span>
                        <span className="hidden min-[380px]:inline">
                            Install ExamCooker
                        </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-black/55 dark:text-[#D5D5D5]/55">
                        Get the Android app from Google Play.
                    </p>
                </div>
                <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleInstallClick}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 border-2 border-black bg-[#5FC4E7] px-3 text-xs font-bold text-black transition active:translate-y-0.5 dark:border-white/15 dark:bg-white/10 dark:text-[#D5D5D5] dark:hover:bg-white/15"
                    aria-label="Install ExamCooker from Google Play"
                >
                    <Download aria-hidden="true" className="size-4" />
                    Install
                </a>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dismiss Android install banner"
                    className="inline-flex size-8 shrink-0 items-center justify-center text-black/40 transition hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/40 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                >
                    <X aria-hidden="true" className="size-4" />
                </button>
            </div>
        </div>
    );
}
