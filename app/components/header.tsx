"use client"

import React, { useState, useRef, useEffect } from "react";
import Switch from "react-switch";
import { useSession } from "next-auth/react";
import Image from 'next/image';
import moon from "@/public/assets/moon.svg";
import sun from "@/public/assets/sun.svg";
import profile from '@/public/assets/Profile.svg';

interface HeaderProps {
  toggleTheme: () => void;
  darkMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleTheme, darkMode }) => {
  const { data: session } = useSession();
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    setShowOverlay(!showOverlay);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        setShowOverlay(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-[#C2E6EC] dark:bg-[#0C1222] border-b border-b-[#82BEE9] dark:border-b-[#3BF4C7] flex flex-row-reverse">
      <div className="flex items-center text-right m-2">
        <div className="hidden sm:flex sm:flex-col mr-4">
          <p className="lg:text-lg font-medium text-gray-900 dark:text-[#D5D5D5]">{session?.user?.name}</p>
          <p className="lg:text-sm text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
        </div>
        <div className="relative">
          <button 
            title='Profile'
            className="w-10 h-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out
                       bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700
                       dark:from-blue-600 dark:to-blue-800 dark:hover:from-blue-700 dark:hover:to-blue-900
                       focus:ring-blue-400 dark:focus:ring-blue-700 focus:ring-offset-white dark:focus:ring-offset-[#0C1222]"
            onClick={handleClick}>
            <Image
              src={profile}
              alt="Profile"
              width={24}
              height={24}
              className="m-auto text-white"
            />
          </button>
          {showOverlay && (
            <div ref={overlayRef} className="absolute top-full right-0 mt-2 p-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg z-10">
              <p className="mb-2 text-gray-900 dark:text-white">Name: <br />{session?.user?.name}</p>
              <p className="mb-2 text-gray-600 dark:text-gray-300">Email:<br /> {session?.user?.email}</p>
              <a href="/logout" className="text-red-500 hover:underline dark:text-red-400">
                Logout
              </a>
            </div>
          )}
        </div>
        <Switch
          onChange={toggleTheme}
          checked={darkMode}
          onColor="#86d3ff"
          offColor="#ffcc00"
          onHandleColor="#2693e6"
          offHandleColor="#ffcc00"
          checkedIcon={
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              padding: 2
            }}>
              <Image
                src={moon}
                alt="moon"
                width={16}
                height={16}
              />
            </div>
          }
          uncheckedIcon={
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              padding: 2
            }}>
              <Image
                src={sun}
                alt="sun"
                width={16}
                height={16}
              />
            </div>
          }
          className="ml-2 mr-4 sm:ml-6"
        />
      </div>
    </header>
  );
};

export default Header;