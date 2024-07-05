"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";

const NavBar: React.FC<{ isNavOn: boolean; toggleNavbar: () => void }> = ({
    isNavOn,
    toggleNavbar,
}) => {
    return (
        <nav
            className={`fixed top-0 left-0 z-50 flex flex-col justify-between items-center h-screen ${
                isNavOn ? "bg-[#5fc4e7] lg:w-[5vw] md:w-[8vw]" : ""
            } text-white p-1 transition-all duration-300 ease-in-out`}
        >
            {isNavOn && (
                <div className="mt-4">
                    <button
                        title="Close Navbar"
                        onClick={toggleNavbar}
                        className="opacity-100"
                    >
                        <Image
                            src="/assets/HamburgerIcon.svg"
                            alt="Close"
                            width={30}
                            height={30}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1"
                        />
                    </button>
                </div>
            )}

            <div className="flex flex-col items-center mt-8">
                <Link href="/home" passHref>
                    <div
                        title="Home"
                        className={`m-2 ${isNavOn ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/Home.svg"
                            alt="Home"
                            width={24}
                            height={25}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                </Link>
                <Link href="/notes" passHref>
                    <div
                        title="Notes"
                        className={`m-2 ${isNavOn ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/NotesIcon.svg"
                            alt="Notes"
                            width={24}
                            height={25}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                </Link>
                <Link href="/past_papers" passHref>
                    <div
                        title="Past Papers"
                        className={`m-2 ${isNavOn ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/PastPapersIcon.svg"
                            alt="Past Papers"
                            width={24}
                            height={25}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                </Link>
                <Link href="/forum" passHref>
                    <div
                        title="Forum"
                        className={`m-2 ${isNavOn ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/ForumIcon.svg"
                            alt="Forum"
                            width={24}
                            height={25}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                </Link>
                <Link href="/resources" passHref>
                    <div
                        title="Resources"
                        className={`m-2 ${isNavOn ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/BookIcon.svg"
                            alt="Book"
                            width={24}
                            height={25}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                </Link>
                <Link href="/favourites" passHref>
                    <div
                        title="Favourites"
                        className={`m-2 ${isNavOn ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/NavFavouriteIcon.svg"
                            alt="Favourites"
                            width={24}
                            height={25}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                </Link>
            </div>
            <div className="mb-4 bottom-5">
                <Link href="/logout" passHref>
                    <div
                        title="Log Out"
                        className={`m-2 ${isNavOn ? "block" : "hidden"}`}
                    >
                        <Image
                            src="/assets/LogoutIcon.svg"
                            alt="Logout"
                            width={24}
                            height={24}
                            className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]"
                        />
                    </div>
                </Link>
            </div>
        </nav>
    );
};

export default NavBar;
