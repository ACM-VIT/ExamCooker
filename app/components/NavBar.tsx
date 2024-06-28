"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const NavBar: React.FC = () => {
  const [isNavOn, setIsNavOn] = useState(false);

  const toggleNavbar = () => {
    setIsNavOn(!isNavOn);
    console.log(isNavOn ? "Nav Off" : "Nav On");
  };

  useEffect(() => {
    if (isNavOn) {
      document.body.classList.add('nav-on');
    } else {
      document.body.classList.remove('nav-on');
    }
  }, [isNavOn]);

  return (
    <nav className={`fixed top-0 left-0 flex flex-col justify-between items-center h-screen ${isNavOn ? "bg-[#5fc4e7]" : ""} text-white p-1 transition-all duration-300 ease-in-out`}>
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
        <Link href="/book" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/BookIcon.svg" alt="Book" width={24} height={25} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
        <Link href="/favourites" passHref>
          <div className={`m-2 ${isNavOn ? "block" : "hidden"}`}>
            <Image src="/assets/NavFavouriteIcon.svg" alt="Favourites" width={24} height={25} className="transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]" />
          </div>
        </Link>
      </div>
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


