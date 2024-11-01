"use client";
import React, {useEffect, useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {usePathname} from "next/navigation";
import Loading from "../loading";

const Tooltip = ({children, content}: { children: React.ReactNode, content: string }) => {
    return (
        <div className="group relative">
            {children}
            <div
                className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gradient-to-r from-[#5fc4e7] to-[#4db3d6] dark:from-[#3BF4C7] dark:to-[#2ad3a7] text-white dark:text-[#232530] rounded-md text-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 ease-in-out z-50 whitespace-nowrap shadow-lg backdrop-blur-sm backdrop-filter max-w-xs break-words">
                <span className="font-medium">{content}</span>
                <div
                    className="absolute w-0 h-0 border-t-[6px] border-b-[6px] border-r-[6px] border-transparent border-r-[#5fc4e7] dark:border-r-[#3BF4C7] -left-[6px] top-1/2 -translate-y-1/2 transform transition-transform duration-300 ease-in-out group-hover:scale-110"></div>
            </div>
        </div>
    );
};

const NavBar: React.FC<{ isNavOn: boolean; toggleNavbar: () => void }> = ({isNavOn, toggleNavbar}) => {
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    function RenderMenuItem({svgSource, alt, disableAnim}: { svgSource: string, alt: string, disableAnim: boolean }) {
        return (
            <Tooltip content={alt}>
                <div onClick={handleLinkClick} className={`flex gap-2 m-2 group ${isNavOn ? "block" : "hidden"}`}>
                    <Image
                        src={svgSource}
                        alt={alt}
                        width={24}
                        height={25}
                        className={`dark:invert-[.835] transition-all transform-gpu group-hover:scale-110 ${!disableAnim ? "group-hover:-translate-y-1 group-hover:rotate-[-5deg]" : ""}`}
                    />
                    <p className={`transition-all text-black font-extrabold ${!disableAnim ? "group-hover:-translate-y-1" : ""}  dark:text-[#D5D5D5] ${isExpanded ? "block" : "hidden"}`}>{alt}</p>
                </div>
            </Tooltip>
        );
    }

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false));
        return () => clearTimeout(timer);
    }, [pathname]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const nav = document.querySelector("nav");
            if (nav && !nav.contains(event.target as Node) && isNavOn) {
                setIsExpanded(false)
                toggleNavbar();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isNavOn, toggleNavbar]);

    const handleLinkClick = () => {
        setLoading(true);
        if (isNavOn) {
            setIsExpanded(false);
            toggleNavbar();
        }
    };

    return (
        <>
            {loading && <Loading/>}
            <nav
                className={`fixed top-0 left-0 z-50 flex flex-col justify-between items-center h-screen ${isNavOn
                    ? "bg-[#5fc4e7] dark:bg-[#232530] dark:border-[#3BF4C7] dark:border w-fit"
                    : ""
                } text-white p-1 transition-colors duration-300 ease-in-out`}
            >
                {isNavOn && (
                    <div className="mt-4">
                        <button
                            onClick={() => {
                                setIsExpanded(false);
                                toggleNavbar();
                            }}
                            className="opacity-100"
                        >
                            <Image
                                src="/assets/HamburgerIcon.svg"
                                alt="Close"
                                width={30}
                                height={30}
                                className="dark:invert-[.835] transition-transform transform-gpu hover:scale-110 hover:-translate-y-1"
                            />
                        </button>
                    </div>
                )}

                <div className="flex flex-col items-center mt-8">
                    <Link href="/" passHref className={`${pathname == '/' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/Home.svg" alt="Home" disableAnim={pathname == "/"}/>
                    </Link>
                    <Link href={"/past_papers"} passHref
                          className={`${pathname == '/past_papers' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/PastPapersIcon.svg" alt="Papers"
                                        disableAnim={pathname == "/past_papers"}/>
                    </Link>
                    <Link href={"/notes"} passHref className={`${pathname == '/notes' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/NotesIcon.svg" alt="Notes"
                                        disableAnim={pathname == "/notes"}/>
                    </Link>
                    <Link href={"/syllabus"} passHref
                          className={`${pathname == '/syllabus' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/SyllabusLogo.svg" alt="Syllabus"
                                        disableAnim={pathname == "/syllabus"}/>
                    </Link>
                    <Link href={"/forum"} passHref className={`${pathname == '/forum' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/ForumIcon.svg" alt="Forum"
                                        disableAnim={pathname == "/forum"}/>
                    </Link>
                    <Link href={"/resources"} passHref
                          className={`${pathname == '/resources' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/BookIcon.svg" alt="Resources"
                                        disableAnim={pathname == "/resources"}/>
                    </Link>
                    <Link href={"/favourites"} passHref
                          className={`${pathname == '/favourites' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/NavFavouriteIcon.svg" alt="Favourites"
                                        disableAnim={pathname == "/favourites"}/>
                    </Link>
                    {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M64 464c-8.8 0-16-7.2-16-16L48 64c0-8.8 7.2-16 16-16l160 0 0 80c0 17.7 14.3 32 32 32l80 0 0 288c0 8.8-7.2 16-16 16L64 464zM64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-293.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0L64 0zm56 256c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-144 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-144 0z"/></svg> */}
                </div>
                <div/>

            </nav>
        </>
    );
};

export default NavBar;
