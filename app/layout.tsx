 "use client";
 import { Plus_Jakarta_Sans } from "next/font/google";
 import "./globals.css";
 import React, { useState, useEffect, useRef } from "react";
 import NavBar from "./components/NavBar";
 import Header from "./components/header"; // Import the Header component

 const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

 export default function RootLayout({
     children,
 }: Readonly<{
     children: React.ReactNode;
 }>) {
     const [isNavOn, setIsNavOn] = useState(false);
     const [darkMode, setDarkMode] = useState(false); // State for dark mode
     const navbarRef = useRef<HTMLDivElement>(null);

     const toggleNavbar = () => {
         setIsNavOn(!isNavOn);
     };

     const toggleTheme = () => {
         setDarkMode(!darkMode); // Toggle dark mode state
     };

     const handleClickOutside = (event: MouseEvent) => {
         if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
             setIsNavOn(false);
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
{                     <div className={darkMode ? 'dark' : ''}>
                         <Header toggleTheme={toggleTheme} darkMode={darkMode} />
                         {children}
                     </div>}
                 </main>
             </body>
         </html>
     );
 }




