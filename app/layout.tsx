"use client";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import React, { useState } from 'react';
import NavBar from "./components/NavBar";

const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });


export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [isNavOn, setIsNavOn] = useState(false);

    const toggleNavbar = () => {
        setIsNavOn(!isNavOn);
    };

    return (
        <html lang="en">
            <body className={`flex bg-white ${plus_jakarta_sans.className}`}>
                <NavBar isNavOn={isNavOn} toggleNavbar={toggleNavbar} />
                <main className={`flex-grow p-4 transition-all duration-300 ease-in-out ${isNavOn ? "lg:w-[95vw] md:w-[92vw] sm:w-[92vw]" : "w-[100vw]"}`}>
                    {children}
                </main>
            </body>
        </html>
    );
}

