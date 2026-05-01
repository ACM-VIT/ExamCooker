"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { usePathname } from "next/navigation";
import ThemeToggleSwitch from "@/app/components/common/theme-toggle";
import { SignOut } from "@/app/components/sign-out";
import VoiceAgentButton from "@/app/components/voice/voice-agent-button";
import { startGoogleSignIn } from "@/lib/start-google-sign-in";
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

const VoiceAgentEntry = dynamic(
  () => import("@/app/components/voice/voice-agent-entry"),
  {
    ssr: false,
    loading: () => (
      <VoiceAgentButton
        buttonLabel="Starting the voice guide"
        disabled
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
  const { isAuthed, requireAuth, session } = useGuestPrompt();
  const voiceAgentEnabled =
    usePostHogFeatureFlagEnabled(POSTHOG_FEATURE_FLAGS.voiceAgent) ?? true;
  const [showProfile, setShowProfile] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [voiceRuntimeRequested, setVoiceRuntimeRequested] = useState(false);
  const [voiceStartToken, setVoiceStartToken] = useState(0);
  const [voiceEntryPoint, setVoiceEntryPoint] = useState<VoiceAgentEntryPoint>("nav");
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    content: string;
    top: number;
    left: number;
  } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const clearTooltip = () => setHoveredTooltip(null);
    window.addEventListener("resize", clearTooltip);
    window.addEventListener("scroll", clearTooltip, true);
    return () => {
      window.removeEventListener("resize", clearTooltip);
      window.removeEventListener("scroll", clearTooltip, true);
    };
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

  const showTooltip = (
    event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>,
    content: string,
  ) => {
    if (typeof window !== "undefined") {
      const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      const isFocusEvent = event.type === "focus";
      if (!canHover && !isFocusEvent) return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      content,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
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
        style={{ viewTransitionName: "persistent-nav" }}
        className={`fixed z-[55] overflow-hidden border-black/15 bg-[#C2E6EC] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] ${isNavOn ? "translate-y-0" : "translate-y-[calc(100%+16px)]"} inset-x-0 bottom-0 max-h-[min(520px,88dvh)] w-full rounded-t-[1.35rem] border border-b-0 shadow-[0_-12px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_-16px_48px_rgba(0,0,0,0.45)] lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-0 lg:flex lg:h-dvh lg:max-h-dvh lg:w-fit lg:translate-x-0 lg:translate-y-0 lg:rounded-none lg:border lg:border-y-0 lg:border-l-0 lg:border-r lg:shadow-none`}
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

          <div className="order-2 grid grid-cols-3 gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10 lg:order-3 lg:mt-auto lg:flex lg:w-full lg:flex-col lg:items-center lg:gap-3 lg:border-b-0 lg:px-2 lg:py-0">
            <div className="flex flex-col items-center gap-2 lg:gap-2">
              <div className="flex min-h-10 items-center justify-center">
                {voiceAgentEnabled ? (
                  <div className="group flex">
                    {voiceRuntimeRequested ? (
                      <VoiceAgentEntry
                        entryPoint={voiceEntryPoint}
                        startToken={voiceStartToken}
                      />
                    ) : (
                      <VoiceAgentButton
                        buttonLabel="Start the voice guide"
                        onClick={() => handleVoiceClick("nav")}
                        runtime={{
                          activity: "idle",
                          connected: false,
                          muted: false,
                        }}
                      />
                    )}
                  </div>
                ) : null}
              </div>
              <span className="text-[11px] font-semibold text-black/48 dark:text-[#D5D5D5]/55 lg:hidden">
                Voice
              </span>
            </div>

            <div className="flex flex-col items-center gap-2 lg:gap-2">
              <div className="flex min-h-10 items-center justify-center">
                <ThemeToggleSwitch />
              </div>
              <span className="text-[11px] font-semibold text-black/48 dark:text-[#D5D5D5]/55 lg:hidden">
                Theme
              </span>
            </div>

            <div className="flex flex-col items-center gap-2 lg:gap-2">
              <div className="relative z-10 flex min-h-10 items-center justify-center">
                {isAuthed ? (
                  <div ref={profileRef}>
                    <button
                      ref={profileButtonRef}
                      type="button"
                      title="Profile"
                      aria-label="Profile"
                      onClick={() => setShowProfile((v) => !v)}
                      className="pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/15 bg-white text-xs font-bold text-black/70 transition-colors duration-200 hover:border-black/40 hover:text-black dark:border-[#D5D5D5]/20 dark:bg-transparent dark:text-[#D5D5D5]/70 dark:hover:border-[#3BF4C7]/60 dark:hover:text-[#3BF4C7]"
                    >
                      {(session?.user?.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
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
                    onClick={() =>
                      startGoogleSignIn(pathname ?? "/", {
                        source: "navbar",
                      })
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/70 transition-colors duration-200 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:bg-white/5 dark:hover:text-[#3BF4C7]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="text-[11px] font-semibold text-black/48 dark:text-[#D5D5D5]/55 lg:hidden">
                Account
              </span>
            </div>
          </div>

          <div className="order-3 hidden min-h-0 flex-1 flex-col items-center overflow-y-auto px-2 py-2 lg:order-2 lg:flex lg:justify-center lg:overflow-visible lg:px-1 lg:py-2">
            {APP_NAV_LINKS.map((link) => {
              const isActive = link.matches
                ? link.matches(pathname)
                : pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  transitionTypes={isActive ? undefined : ["nav-lateral"]}
                  className={isActive ? "bg-[#ffffff]/20" : ""}
                >
                  <div
                    className="group flex m-2"
                    onMouseEnter={(event) => showTooltip(event, link.alt)}
                    onMouseLeave={() => setHoveredTooltip(null)}
                    onFocus={(event) => showTooltip(event, link.alt)}
                    onBlur={() => setHoveredTooltip(null)}
                  >
                    <Image
                      src={link.svgSource}
                      alt={link.alt}
                      width={24}
                      height={25}
                      className={`dark:invert-[.835] transition-all transform-gpu can-hover:group-hover:scale-110 ${!isActive
                        ? "can-hover:group-hover:-translate-y-1 can-hover:group-hover:rotate-[-5deg]"
                        : ""
                        }`}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      {hoveredTooltip && (
        <div
          className="pointer-events-none fixed z-[80] max-w-xs -translate-y-1/2 whitespace-nowrap rounded-md bg-gradient-to-r from-[#5fc4e7] to-[#4db3d6] px-3 py-2 text-sm text-white shadow-lg backdrop-blur-sm dark:from-[#3BF4C7] dark:to-[#2ad3a7] dark:text-[#232530]"
          style={{ top: hoveredTooltip.top, left: hoveredTooltip.left }}
        >
          <span className="font-medium">{hoveredTooltip.content}</span>
          <div className="absolute -left-[6px] top-1/2 h-0 w-0 -translate-y-1/2 border-b-[6px] border-r-[6px] border-t-[6px] border-b-transparent border-r-[#5fc4e7] border-t-transparent dark:border-r-[#3BF4C7]" />
        </div>
      )}
    </>
  );
};

export default NavBar;
