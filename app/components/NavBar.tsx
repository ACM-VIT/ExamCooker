"use client";
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const NavBar: React.FC<{ isNavOn: boolean; toggleNavbar: () => void }> = ({ isNavOn, toggleNavbar }) => {
  return (
    <nav className={`absolute top-0 left-0 z-50 flex flex-col justify-between items-center h-screen ${isNavOn ? "bg-[#5fc4e7] lg:w-[5vw] md:w-[8vw] sm:w-[8vw]" : ""} text-white p-1 transition-all duration-300 ease-in-out`}>
      <div className="mt-4">
        <button onClick={toggleNavbar} className="opacity-100">
          <Image src="/assets/HamburgerIcon.svg" alt="Menu" width={30} height={30} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1" />
        </button>
      </div>
      <div className="flex flex-col items-center mt-8">
        <Link href="/notes" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/NotesIcon.svg" alt="Notes" width={24} height={25} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
        <Link href="/past_papers" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/PastPapersIcon.svg" alt="Past Papers" width={24} height={25} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
        <Link href="/forum" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/ForumIcon.svg" alt="Forum" width={24} height={25} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
        {/* Dummy Path */}
        <Link href="/resources" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/BookIcon.svg" alt="Book" width={24} height={25} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
        {/* Dummy Path */}
        <Link href="/favourites" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/NavFavouriteIcon.svg" alt="Favourites" width={24} height={25} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
      </div>
      {/* Dummy Path */}
      <div className="mb-4 bottom-5">
        <Link href="/logout" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/LogoutIcon.svg" alt="Logout" width={24} height={24} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
      </div>
    </nav>
  );
};

export default NavBar;
