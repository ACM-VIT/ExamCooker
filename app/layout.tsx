"use client";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import React, { useState, useEffect, useRef } from "react";
import NavBar from "./components/NavBar";
import Header from "./components/header"; 
import Image from 'next/image';
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/dist/server/api-utils";

const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isNavOn, setIsNavOn] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // State for dark mode
  const navbarRef = useRef<HTMLDivElement>(null);

  const prisma = new PrismaClient();
  // const session = await auth();
  // if(!session || !session.user) return 

  useEffect(() => {
    const savedNavState = localStorage.getItem('isNavOn');
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedNavState !== null) {
      setIsNavOn(savedNavState === 'true');
    }
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  const toggleNavbar = () => {
    setIsNavOn(prevState => {
      const newState = !prevState;
      localStorage.setItem('isNavOn', newState.toString());
      return newState;
    });
  };

  const toggleTheme = () => {
    setDarkMode(prevState => {
      const newState = !prevState;
      localStorage.setItem('darkMode', newState.toString());
      return newState;
    });
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
      setIsNavOn(false);
      localStorage.setItem('isNavOn', 'false');
    }
  };

  useEffect(() => {
    if (isNavOn) {
      document.addEventListener("mousedown", handleClickOutside as EventListener);
    } else {
      document.removeEventListener("mousedown", handleClickOutside as EventListener);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside as EventListener);
    };
  }, [isNavOn]);

  return (
    <html lang="en">
      <body
        className={`relative flex ${darkMode ? 'bg-gray-900 text-white' : 'bg-[#c2e6ec] text-black'} ${plus_jakarta_sans.className}`}
      >
        {!isNavOn && (
          <button title="Open Navbar" onClick={toggleNavbar} className="absolute top-4 left-4 z-50 opacity-100">
            <Image src="/assets/HamburgerIcon.svg" alt="Menu" width={30} height={30} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1" />
          </button>
        )}
        <div ref={navbarRef}>
          <NavBar isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
        </div>
        {isNavOn && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-10 transition-opacity duration-300"></div>
        )}
        <main
          className={`flex-grow transition-all duration-300 ease-in-out ${
            isNavOn ? "lg:w-[95vw] md:w-[92vw]" : "w-[100vw]"
          }`}
        >
          <div className={darkMode ? 'dark' : ''}>
            <Header toggleTheme={toggleTheme} darkMode={darkMode} />
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
