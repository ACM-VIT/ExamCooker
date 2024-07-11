"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Loading from "../loading"; // Import the Loading component
import { SignOut } from "./sign-out";

const NavBar: React.FC<{ isNavOn: boolean; toggleNavbar: () => void }> = ({
    isNavOn,
    toggleNavbar,
}) => {
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    function RenderMenuItem({ svgSource, alt, disableAnim }: { svgSource: string, alt: string, disableAnim: boolean }) {
        return (
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
        );
    }

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false)); // Simulate loading time
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
            {loading && <Loading />}
            <nav
                className={`fixed top-0 left-0 z-50 flex flex-col justify-between items-center h-screen ${isNavOn
                    ? "bg-[#5fc4e7] dark:bg-[#232530] dark:border-[#3BF4C7] dark:border w-fit"
                    : ""
                    } text-white p-1 transition-all duration-300 ease-in-out`}
            >
                {isNavOn && (
                    <div className="mt-4">
                        <button
                            title="Close Navbar"
                            onClick={()=>{
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
                    <Link href="/notes" passHref className={`${pathname == '/notes' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/NotesIcon.svg" alt="Notes" disableAnim={pathname == "/notes"}/>
                    </Link>
                    <Link href="/past_papers" passHref className={`${pathname == '/past_papers' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/PastPapersIcon.svg" alt="Papers" disableAnim={pathname == "/past_papers"}/>
                    </Link>
                    <Link href="/forum" passHref className={`${pathname == '/forum' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/ForumIcon.svg" alt="Forum" disableAnim={pathname == "/forum"}/>
                    </Link>
                    <Link href="/resources" passHref className={`${pathname == '/resources' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/BookIcon.svg" alt="Resources" disableAnim={pathname == "/resources"}/>
                    </Link>
                    <Link href="/favourites" passHref className={`${pathname == '/favourites' ? "bg-[#ffffff]/20" : ""}`}>
                        <RenderMenuItem svgSource="/assets/NavFavouriteIcon.svg" alt="Favourites" disableAnim={pathname == "/favourites"}/>
                    </Link>
                </div>
                <div />
                <div className="mb-4 bottom-5 w-full">
                    <div
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`m-2 ${isNavOn ? "block" : "hidden"} ${!isExpanded ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/LogoutIcon.svg"
                            alt="Logout"
                            width={24}
                            height={24}
                            className="dark:invert-[.835] transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                    <div
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`m-2 ${isNavOn ? "block" : "hidden"} ${isExpanded ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/LogoutIcon.svg"
                            alt="Logout"
                            width={24}
                            height={24}
                            className="dark:invert-[.835] transition-transform transform-gpu -rotate-180 hover:scale-110 hover:-translate-y-1 hover:-rotate-[175deg]"
                        />
                    </div>
                </div>
            </nav>
        </>
    );
};

export default NavBar;
