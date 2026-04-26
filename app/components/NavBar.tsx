"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/app/components/common/AppImage";
import { usePathname } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import ThemeToggleSwitch from "@/app/components/common/ThemeToggle";
import { SignOut } from "@/app/components/sign-out";

type MenuLink = {
  href: string;
  svgSource: string;
  alt: string;
  matches?: (pathname: string | null) => boolean;
};

const LINKS: MenuLink[] = [
  { href: "/", svgSource: "/assets/Home.svg", alt: "Home" },
  { href: "/past_papers", svgSource: "/assets/PastPapersIcon.svg", alt: "Papers" },
  { href: "/notes", svgSource: "/assets/NotesIcon.svg", alt: "Notes" },
  { href: "/syllabus", svgSource: "/assets/SyllabusLogo.svg", alt: "Syllabus" },
  // { href: "/forum", svgSource: "/assets/ForumIcon.svg", alt: "Forum" },
  { href: "/resources", svgSource: "/assets/BookIcon.svg", alt: "Resources" },
  // { href: "/favourites", svgSource: "/assets/NavFavouriteIcon.svg", alt: "Favourites" },
  { href: "/quiz", svgSource: "/assets/QuizIcon.svg", alt: "Quiz" },
];

type Props = {
  isNavOn: boolean;
  toggleNavbar: () => void;
};

const NavBar: React.FC<Props> = ({ isNavOn, toggleNavbar }) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAuthed = Boolean(session?.user);
  const [showProfile, setShowProfile] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

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
        className={`group/nav fixed top-0 left-0 z-50 h-dvh max-h-dvh w-fit overflow-visible border-r border-black/15 bg-[#C2E6EC] transition-all duration-300 ease-in-out dark:border-r-[#D5D5D5]/15 dark:bg-[#0C1222] ${isNavOn ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        <div className="flex h-full max-h-dvh flex-col items-stretch justify-between overflow-y-auto overscroll-contain p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
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

          <div className="flex flex-col items-stretch">
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
                  <div className="group flex items-center m-2 cursor-pointer">
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <Image
                        src={link.svgSource}
                        alt={link.alt}
                        width={24}
                        height={25}
                        className={`dark:invert-[.835] transition-all transform-gpu can-hover:group-hover:scale-110 group-hover:[filter:invert(67%)_sepia(97%)_saturate(402%)_hue-rotate(164deg)_brightness(97%)_contrast(86%)] dark:group-hover:[filter:invert(78%)_sepia(38%)_saturate(690%)_hue-rotate(107deg)_brightness(96%)_contrast(100%)] ${!isActive
                          ? "can-hover:group-hover:-translate-y-1 can-hover:group-hover:rotate-[-5deg]"
                          : ""
                          }`}
                      />
                    </div>
                    <span className="overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 max-w-0 opacity-0 group-hover/nav:max-w-[150px] group-hover/nav:opacity-100 group-hover/nav:ml-3 text-black group-hover:text-[#5fc4e7] dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7]">
                      {link.alt}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mb-2 flex flex-col items-start gap-2 pl-2">
            <div className="flex items-center mb-1 group/item">
              <ThemeToggleSwitch />
              <span className="overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 max-w-0 opacity-0 group-hover/nav:max-w-[150px] group-hover/nav:opacity-100 group-hover/nav:ml-3 text-black group-hover/item:text-[#5fc4e7] dark:text-[#D5D5D5] dark:group-hover/item:text-[#3BF4C7]">
                Theme
              </span>
            </div>
            {isAuthed ? (
              <div className="relative flex items-center group/item" ref={profileRef}>
                <button
                  type="button"
                  title="Profile"
                  aria-label="Profile"
                  onClick={() => setShowProfile((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-white text-xs font-bold text-black/70 transition-colors duration-200 hover:border-black/40 hover:text-black dark:border-[#D5D5D5]/20 dark:bg-transparent dark:text-[#D5D5D5]/70 dark:hover:border-[#3BF4C7]/60 dark:hover:text-[#3BF4C7]"
                >
                  {(session?.user?.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                </button>
                {showProfile && (
                  <div className="absolute bottom-0 left-full ml-3 w-56 rounded-md border border-black/10 bg-white p-3 shadow-lg dark:border-[#D5D5D5]/15 dark:bg-[#121B31]">
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
                <span className="overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 max-w-0 opacity-0 group-hover/nav:max-w-[150px] group-hover/nav:opacity-100 group-hover/nav:ml-3 text-black group-hover/item:text-[#5fc4e7] dark:text-[#D5D5D5] dark:group-hover/item:text-[#3BF4C7]">
                  Profile
                </span>
              </div>
            ) : (
              <div className="flex items-center mt-1 group/item">
                <button
                  type="button"
                  title="Sign in"
                aria-label="Sign in"
                onClick={() => signIn("google", { callbackUrl: pathname ?? "/" })}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-black/70 transition-colors duration-200 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:bg-white/5 dark:hover:text-[#3BF4C7]"
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
              <span className="overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 max-w-0 opacity-0 group-hover/nav:max-w-[150px] group-hover/nav:opacity-100 group-hover/nav:ml-3 text-black group-hover/item:text-[#5fc4e7] dark:text-[#D5D5D5] dark:group-hover/item:text-[#3BF4C7]">
                Sign In
              </span>
            </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default NavBar;
