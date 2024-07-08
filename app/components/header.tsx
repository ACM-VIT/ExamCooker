"use client"

import React from "react";
import Switch from "react-switch";
import { useSession } from "next-auth/react";
import moon from "@/public/assets/moon.svg";
import sun from "@/public/assets/sun.svg";
import NextAuth from "next-auth";

interface HeaderProps {
  toggleTheme: () => void;
  darkMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleTheme, darkMode }) => {

  const { data: session, status } = useSession();

  return (
    <header className="bg-[#C2E6EC] border-b border-b-[#82BEE9] dark:border-b-[#3BF4C7] dark:bg-[#0C1222] flex flex-row-reverse">
      <div className="flex items-center text-right m-2">
        <div className="flex flex-col mr-4">
          <p className="text-lg font-medium text-gray-900 dark:text-[#D5D5D5]">{session?.user?.name}</p>
          <p className="text-sm text-gray-500">{session?.user?.email}</p> 
        </div>
        <div className="w-10 h-10 bg-gray-300 rounded-full sm:mr-4"></div>
        <Switch
          onChange={toggleTheme}
          checked={darkMode}
          onColor="#86d3ff"
          offColor="#ffcc00"
          onHandleColor="#2693e6"
          offHandleColor="#ffcc00"
          checkedIcon={
            <img
              src={moon.src}
              alt="moon"
              style={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 2,
              }}
            />
          }
          uncheckedIcon={
            <img
              src={sun.src}
              alt="sun"
              style={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 2,
              }}
            />
          }
          className="ml-2 mr-4 sm:ml-6"
        />
      </div>
    </header>
  );
};

export default Header;

