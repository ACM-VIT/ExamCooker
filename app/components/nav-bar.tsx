"use client";
import React, { addTransitionType, startTransition, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggleSwitch from "@/app/components/common/theme-toggle";
import { SignOut } from "@/app/components/sign-out";
import VoiceAgentButton from "@/app/components/voice/voice-agent-button";
import { useGuestPrompt } from "@/app/components/guest-prompt-provider";
import {
  captureVoiceAgentRequested,
  type VoiceAgentEntryPoint,
} from "@/lib/posthog/client";
import { POSTHOG_FEATURE_FLAGS } from "@/lib/posthog/shared";
import { usePostHogFeatureFlagEnabled } from "@/lib/posthog/use-feature-flag-enabled";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";
import { X } from "lucide-react";

type Props = {
  isNavOn: boolean;
  toggleNavbar: () => void;
};

const navActionButtonClassName =
  "text-black hover:text-[#0D5875] dark:text-[#D5D5D5] dark:hover:text-[#3BF4C7] lg:h-auto lg:w-full lg:justify-start lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:hover:bg-transparent lg:dark:bg-transparent lg:dark:hover:bg-transparent";
const navActionIconClassName =
  "h-6 w-6 transform-gpu transition-all can-hover:group-hover/action:-translate-y-1 can-hover:group-hover/action:rotate-[-5deg] can-hover:group-hover/action:scale-110";
const navActionLabelBaseClassName =
  "hidden overflow-hidden whitespace-nowrap text-sm font-medium text-black transition-all duration-300 lg:block lg:group-hover/action:text-[#0D5875] lg:dark:text-[#D5D5D5] lg:dark:group-hover/action:text-[#3BF4C7]";

const VoiceAgentEntry = dynamic(
  () => import("@/app/components/voice/voice-agent-entry"),
  {
    ssr: false,
    loading: () => (
      <VoiceAgentButton
        buttonLabel="Starting the voice guide"
        className={navActionButtonClassName}
        disabled
        iconClassName={navActionIconClassName}
        onClick={() => undefined}
        runtime={{
          activity: "connecting",
          connected: false,
          muted: false,
        }}
      />
    ),
  },
);

const NavBar: React.FC<Props> = ({ isNavOn, toggleNavbar }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthed, requireAuth, openPrompt, session } = useGuestPrompt();
  const voiceAgentEnabled =
    usePostHogFeatureFlagEnabled(POSTHOG_FEATURE_FLAGS.voiceAgent) ?? true;
  const [showProfile, setShowProfile] = useState(false);
  const [keepNavExpanded, setKeepNavExpanded] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [voiceRuntimeRequested, setVoiceRuntimeRequested] = useState(false);
  const [voiceStartToken, setVoiceStartToken] = useState(0);
  const [voiceEntryPoint, setVoiceEntryPoint] = useState<VoiceAgentEntryPoint>("nav");
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const keepNavExpandedFromPathRef = useRef(pathname);
  const navLabelClassName = `${navActionLabelBaseClassName} ${
    keepNavExpanded
      ? "lg:ml-3 lg:max-w-[150px] lg:opacity-100"
      : "lg:max-w-0 lg:opacity-0 lg:group-hover/nav:ml-3 lg:group-hover/nav:max-w-[150px] lg:group-hover/nav:opacity-100 lg:group-focus-within/nav:ml-3 lg:group-focus-within/nav:max-w-[150px] lg:group-focus-within/nav:opacity-100"
  }`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateProfileMenuPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const button = profileButtonRef.current;
    if (!button) return;

    const buttonRect = button.getBoundingClientRect();
    const menuRect = profileMenuRef.current?.getBoundingClientRect();
    const menuWidth = menuRect?.width ?? 224;
    const menuHeight = menuRect?.height ?? 120;
    const margin = 12;
    const gap = 12;

    const compactMobile = window.matchMedia("(max-width: 1023px)").matches;

    if (compactMobile) {
      const left = Math.min(
        Math.max(buttonRect.left + buttonRect.width / 2 - menuWidth / 2, margin),
        window.innerWidth - menuWidth - margin,
      );
      const top = Math.min(
        Math.max(buttonRect.top - menuHeight - gap, margin),
        window.innerHeight - menuHeight - margin,
      );
      setProfileMenuPosition({ top, left });
      return;
    }

    const top = Math.min(
      Math.max(buttonRect.top, margin),
      window.innerHeight - menuHeight - margin,
    );
    const left = Math.min(
      buttonRect.right + gap,
      window.innerWidth - menuWidth - margin,
    );

    setProfileMenuPosition({
      top,
      left: Math.max(left, margin),
    });
  }, []);

  useEffect(() => {
    if (!showProfile) {
      setProfileMenuPosition(null);
      return;
    }

    const frame = window.requestAnimationFrame(updateProfileMenuPosition);
    window.addEventListener("resize", updateProfileMenuPosition);
    window.addEventListener("scroll", updateProfileMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateProfileMenuPosition);
      window.removeEventListener("scroll", updateProfileMenuPosition, true);
    };
  }, [showProfile, updateProfileMenuPosition]);

  useEffect(() => {
    if (!keepNavExpanded) return;
    const routeChanged = pathname !== keepNavExpandedFromPathRef.current;
    const timeout = window.setTimeout(
      () => setKeepNavExpanded(false),
      routeChanged ? 450 : 1200,
    );
    return () => window.clearTimeout(timeout);
  }, [keepNavExpanded, pathname]);

  const setNavTransitionOrigin = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--nav-vt-x",
      `${rect.left + rect.width / 2}px`,
    );
    document.documentElement.style.setProperty(
      "--nav-vt-y",
      `${rect.top + rect.height / 2}px`,
    );
  };

  const keepExpandedForNavigation = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const link = target.closest("a[href]");
    if (!link) return;
    setNavTransitionOrigin(link as HTMLElement);
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    keepNavExpandedFromPathRef.current = pathname;
    setKeepNavExpanded(true);
  };

  const handleNavLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    isActive: boolean,
  ) => {
    if (
      isActive ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    setNavTransitionOrigin(event.currentTarget);
    startTransition(() => {
      addTransitionType("nav-lateral");
      router.push(href);
    });
  };

  const handleVoiceClick = useCallback((entryPoint: VoiceAgentEntryPoint = "nav") => {
    captureVoiceAgentRequested({
      entryPoint,
      authenticated: isAuthed,
    });

    if (!isAuthed) {
      requireAuth("use the voice guide");
      return;
    }

    setVoiceEntryPoint(entryPoint);
    setVoiceRuntimeRequested(true);
    setVoiceStartToken((current) => current + 1);
  }, [isAuthed, requireAuth]);

  useEffect(() => {
    const handler = (event: Event) => {
      const source =
        event instanceof CustomEvent &&
        typeof event.detail === "object" &&
        event.detail !== null &&
        "source" in event.detail &&
        (event.detail.source === "home_search" || event.detail.source === "nav")
          ? event.detail.source
          : "home_search";
      handleVoiceClick(source);
    };
    window.addEventListener("examcooker:voice-agent-start", handler);
    return () => window.removeEventListener("examcooker:voice-agent-start", handler);
  }, [handleVoiceClick]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (cancelled || Capacitor.getPlatform() !== "ios") return;
        const { NativeTabs } = await import("capacitor-native-tabs");
        if (isNavOn) {
          await NativeTabs.hideTabBar().catch(() => undefined);
        } else {
          await NativeTabs.showTabBar().catch(() => undefined);
        }
      } catch {
        // Plugin unavailable outside Capacitor iOS shell
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNavOn]);

  return (
    <>
      <div
        onClick={toggleNavbar}
        aria-hidden="true"
        className={`fixed inset-0 z-[54] bg-black/65 backdrop-blur-[3px] transition-opacity duration-200 lg:hidden ${isNavOn ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <nav
        aria-label="Tools and navigation"
        onClickCapture={keepExpandedForNavigation}
        style={{ viewTransitionName: "persistent-nav" }}
        className={`group/nav fixed z-[55] overflow-hidden border-black/15 bg-[#C2E6EC] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] ${isNavOn ? "translate-y-0" : "translate-y-[calc(100%+16px)]"} inset-x-0 bottom-0 max-h-[min(520px,88dvh)] w-full rounded-t-[1.35rem] border border-b-0 shadow-[0_-12px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_-16px_48px_rgba(0,0,0,0.45)] lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-0 lg:flex lg:h-dvh lg:max-h-dvh lg:w-fit lg:translate-x-0 lg:translate-y-0 lg:rounded-none lg:border lg:border-y-0 lg:border-l-0 lg:border-r lg:shadow-none`}
      >
        <div className="flex max-h-[min(520px,88dvh)] min-h-0 w-full flex-col overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:h-full lg:max-h-dvh lg:w-fit lg:pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="order-1 shrink-0 lg:order-1">
            <div className="border-b border-black/10 px-4 pb-3 pt-3 dark:border-white/10 lg:hidden">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/12 dark:bg-white/18" aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[17px] font-semibold tracking-tight text-black dark:text-[#EAF6FF]">
                  Tools
                </p>
                <button
                  type="button"
                  onClick={toggleNavbar}
                  aria-label="Close tools menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-black/50 transition-colors hover:bg-black/[0.07] active:bg-black/[0.11] dark:text-[#D5D5D5]/55 dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="hidden min-h-[2.5rem] lg:block" aria-hidden />
          </div>

          <div className="order-2 grid grid-cols-3 gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10 lg:order-3 lg:mt-auto lg:flex lg:w-full lg:flex-col lg:items-stretch lg:gap-0 lg:border-b-0 lg:px-1 lg:py-2">
            <div className="group/action flex flex-col items-center gap-2 lg:m-2 lg:min-h-8 lg:flex-row lg:gap-0">
              <div className="flex min-h-10 items-center justify-center lg:min-h-0 lg:w-full">
                {voiceAgentEnabled ? (
                  <div className="flex lg:w-full">
                    {voiceRuntimeRequested ? (
                      <VoiceAgentEntry
                        entryPoint={voiceEntryPoint}
                        startToken={voiceStartToken}
                      />
                    ) : (
                      <VoiceAgentButton
                        buttonLabel="Start the voice guide"
                        className={navActionButtonClassName}
                        iconClassName={navActionIconClassName}
                        onClick={() => handleVoiceClick("nav")}
                        runtime={{
                          activity: "idle",
                          connected: false,
                          muted: false,
                        }}
                      >
                        <span className={navLabelClassName}>Voice</span>
                      </VoiceAgentButton>
                    )}
                  </div>
                ) : null}
              </div>
              <span className="text-[11px] font-semibold text-black/48 dark:text-[#D5D5D5]/55 lg:hidden">
                Voice
              </span>
            </div>

            <div className="group/action flex flex-col items-center gap-2 lg:m-2 lg:min-h-8 lg:flex-row lg:gap-0">
              <div className="flex min-h-10 items-center justify-center lg:min-h-0 lg:w-full">
                <ThemeToggleSwitch
                  className={navActionButtonClassName}
                  iconClassName={navActionIconClassName}
                >
                  <span className={navLabelClassName}>Theme</span>
                </ThemeToggleSwitch>
              </div>
              <span className="text-[11px] font-semibold text-black/48 dark:text-[#D5D5D5]/55 lg:hidden">
                Theme
              </span>
            </div>

            <div className="group/action flex flex-col items-center gap-2 lg:m-2 lg:min-h-8 lg:flex-row lg:gap-0">
              <div className="relative z-10 flex min-h-10 items-center justify-center lg:min-h-0 lg:w-full">
                {isAuthed ? (
                  <div className="lg:w-full" ref={profileRef}>
                    <button
                      ref={profileButtonRef}
                      type="button"
                      title="Profile"
                      aria-label="Profile"
                      onClick={() => setShowProfile((v) => !v)}
                      className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-black transition-colors duration-200 hover:text-[#0D5875] dark:text-[#D5D5D5] dark:hover:text-[#3BF4C7] lg:h-auto lg:w-full lg:justify-start lg:rounded-none lg:p-0"
                    >
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 can-hover:group-hover/action:-translate-y-1 can-hover:group-hover/action:rotate-[-5deg] can-hover:group-hover/action:scale-110">
                        {(session?.user?.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <span className={navLabelClassName}>Account</span>
                    </button>
                    {showProfile && (
                      <div
                        ref={profileMenuRef}
                        className="fixed z-[90] w-56 rounded-md border border-black/10 bg-white p-3 shadow-lg dark:border-[#D5D5D5]/15 dark:bg-[#121B31]"
                        style={
                          profileMenuPosition
                            ? {
                                top: profileMenuPosition.top,
                                left: profileMenuPosition.left,
                                maxHeight: "calc(100dvh - 1.5rem)",
                              }
                            : {
                                top: 12,
                                left: 12,
                                visibility: "hidden",
                              }
                        }
                      >
                        <p className="mb-1 text-sm font-semibold text-black dark:text-[#D5D5D5]">
                          {session?.user?.name}
                        </p>
                        <p className="mb-3 break-words text-xs text-black/60 dark:text-[#D5D5D5]/60">
                          {session?.user?.email}
                        </p>
                        <SignOut>
                          <span className="text-xs font-semibold text-red-500 hover:underline dark:text-red-400">
                            Sign out
                          </span>
                        </SignOut>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Sign in"
                    aria-label="Sign in"
                    onClick={() => openPrompt("continue")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors duration-200 hover:text-[#0D5875] dark:text-[#D5D5D5] dark:hover:text-[#3BF4C7] lg:h-auto lg:w-full lg:justify-start lg:rounded-none lg:p-0"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={navActionIconClassName}
                      aria-hidden="true"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    <span className={navLabelClassName}>Account</span>
                  </button>
                )}
              </div>
              <span className="text-[11px] font-semibold text-black/48 dark:text-[#D5D5D5]/55 lg:hidden">
                Account
              </span>
            </div>
          </div>

          <div className="order-3 hidden min-h-0 flex-1 flex-col items-stretch overflow-y-auto px-2 py-2 lg:order-2 lg:flex lg:justify-center lg:overflow-visible lg:px-1 lg:py-2">
            {APP_NAV_LINKS.map((link) => {
              const isActive = link.matches
                ? link.matches(pathname)
                : pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  transitionTypes={isActive ? undefined : ["nav-lateral"]}
                  onClick={(event) => handleNavLinkClick(event, link.href, isActive)}
                  className={`group/action m-2 flex min-h-8 items-center rounded-md ${isActive ? "bg-[#ffffff]/20" : ""}`}
                >
                  <div className="flex items-center cursor-pointer">
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <Image
                        src={link.svgSource}
                        alt={link.alt}
                        width={24}
                        height={25}
                        className={`dark:invert-[.835] transition-all transform-gpu can-hover:group-hover/action:scale-110 group-hover/action:[filter:invert(27%)_sepia(85%)_saturate(782%)_hue-rotate(159deg)_brightness(86%)_contrast(91%)] dark:group-hover/action:[filter:invert(78%)_sepia(38%)_saturate(690%)_hue-rotate(107deg)_brightness(96%)_contrast(100%)] ${!isActive
                          ? "can-hover:group-hover/action:-translate-y-1 can-hover:group-hover/action:rotate-[-5deg]"
                          : ""
                          }`}
                      />
                    </div>
                    <span className={navLabelClassName}>
                      {link.alt}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

export default NavBar;
