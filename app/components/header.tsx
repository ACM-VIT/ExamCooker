"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import profile from "@/public/assets/Profile.svg";
import { SignOut } from "./sign-out";
import ThemeToggleSwitch from "./common/ThemeToggle";
import TodoListDropdown from "./TodoListModal";

interface HeaderProps {
  toggleTheme: () => void;
  darkMode: boolean;
}

const Header: React.FC<HeaderProps> = () => {
  const { data: session } = useSession();
  const isAuthed = Boolean(session?.user);
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null!);

  const handleClick = () => {
    setShowOverlay(!showOverlay);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node)
      ) {
        setShowOverlay(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="transition-colors bg-[#C2E6EC] dark:bg-[#0C1222] border-b border-black dark:border-b-[#3BF4C7] flex flex-row-reverse">
      <div className="flex items-center text-right m-2 space-x-4">
        <div className="sm:w-[70vw]">
          {/* <TodoListDropdown buttonRef={buttonRef} /> */}
        </div>
        <ThemeToggleSwitch />
        {isAuthed ? (
          <>
            <div className="hidden sm:flex sm:flex-col mr-4">
              <p className="lg:text-base font-medium text-gray-900 dark:text-[#D5D5D5]">
                {session?.user?.name}
              </p>
              <p className="lg:text-sm text-gray-500 dark:text-gray-400">
                {session?.user?.email}
              </p>
            </div>
            <div className="relative">
              <button
                title="Profile"
                className="w-10 h-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out
                           bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700
                           dark:from-blue-600 dark:to-blue-800 dark:hover:from-blue-700 dark:hover:to-blue-900
                           focus:ring-blue-400 dark:focus:ring-blue-700 focus:ring-offset-white dark:focus:ring-offset-[#0C1222]"
                onClick={handleClick}
              >
                <Image
                  src={profile}
                  alt="Profile"
                  width={24}
                  height={24}
                  className="m-auto text-white"
                />
              </button>
              {showOverlay && (
                <div
                  ref={overlayRef}
                  className="absolute top-full right-0 mt-2 p-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg z-10"
                >
                  <p className="mb-2 text-gray-900 dark:text-white">
                    Name: <br />
                    {session?.user?.name}
                  </p>
                  <p className="mb-2 text-gray-600 dark:text-gray-300">
                    Email:
                    <br /> {session?.user?.email}
                  </p>
                  <SignOut>
                    <span className="text-red-500 hover:underline dark:text-red-400">
                      Logout
                    </span>
                  </SignOut>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <a
              href="/api/auth/init"
              className="border border-black dark:border-[#D5D5D5] px-3 py-1 text-sm font-semibold bg-[#3BF4C7] text-black dark:bg-[#0C1222] dark:text-[#D5D5D5] hover:-translate-x-0.5 hover:-translate-y-0.5 transition"
            >
              Sign In
            </a>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
