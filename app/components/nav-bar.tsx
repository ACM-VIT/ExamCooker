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
import HomeIcon from "@/public/assets/home.svg";
import PastPapersIcon from "@/public/assets/past-papers-icon.svg";
import NotesIcon from "@/public/assets/notes-icon.svg";
import SyllabusIcon from "@/public/assets/syllabus-logo.svg";
import ResourcesIcon from "@/public/assets/book-icon.svg";
import QuizIcon from "@/public/assets/quiz-icon.svg";

type MenuLink = {
  href: string;
  svgSource: string | { src: string; width?: number; height?: number };
  alt: string;
  matches?: (pathname: string | null) => boolean;
};

const LINKS: MenuLink[] = [
  { href: "/", svgSource: HomeIcon, alt: "Home" },
  { href: "/past_papers", svgSource: PastPapersIcon, alt: "Papers" },
  { href: "/notes", svgSource: NotesIcon, alt: "Notes" },
  { href: "/syllabus", svgSource: SyllabusIcon, alt: "Syllabus" },
  // { href: "/forum", svgSource: "/assets/forum-icon.svg", alt: "Forum" },
  { href: "/resources", svgSource: ResourcesIcon, alt: "Resources" },
  { href: "/quiz", svgSource: QuizIcon, alt: "Quiz" },
];

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

  return (
    <>
      <button
        type="button"
        onClick={toggleNavbar}
        aria-label={isNavOn ? "Close navigation" : "Open navigation"}
        aria-expanded={isNavOn}
        style={{ viewTransitionName: "persistent-menu-button" }}
        className={`fixed top-3 left-3 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-black shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur transition-all duration-200 active:scale-95 hover:border-black/25 hover:bg-white hover:shadow-md dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/90 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/40 dark:hover:bg-[#0C1222] lg:hidden ${isNavOn ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h10" />
        </svg>
      </button>

      <div
        onClick={toggleNavbar}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${isNavOn ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
      />

      <nav
        style={{ viewTransitionName: "persistent-nav" }}
        className={`fixed top-0 left-0 z-50 h-dvh max-h-dvh w-fit overflow-visible border-r border-black/15 bg-[#C2E6EC] transition-transform duration-200 ease-out dark:border-r-[#D5D5D5]/15 dark:bg-[#0C1222] ${isNavOn ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        <div className="flex h-full max-h-dvh w-fit flex-col items-center justify-between overflow-y-auto overscroll-contain p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:pb-6">
          <div className="flex w-full min-h-[2.5rem] items-center justify-start px-1">
            <button
              type="button"
              onClick={toggleNavbar}
              aria-label="Close navigation"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-black/60 transition-colors hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5] lg:hidden"
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
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col items-center">
            {LINKS.map((link) => {
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

          <div className="relative z-10 mb-1 flex flex-col items-center gap-2">
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
            <ThemeToggleSwitch />
            {isAuthed ? (
              <div className="relative z-10" ref={profileRef}>
                <button
                  ref={profileButtonRef}
                  type="button"
                  title="Profile"
                  aria-label="Profile"
                  onClick={() => setShowProfile((v) => !v)}
                  className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-black/15 bg-white text-xs font-bold text-black/70 transition-colors duration-200 hover:border-black/40 hover:text-black dark:border-[#D5D5D5]/20 dark:bg-transparent dark:text-[#D5D5D5]/70 dark:hover:border-[#3BF4C7]/60 dark:hover:text-[#3BF4C7]"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black/70 transition-colors duration-200 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:bg-white/5 dark:hover:text-[#3BF4C7]"
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
