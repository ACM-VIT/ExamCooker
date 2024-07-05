import React from "react";
import Switch from "react-switch";
import moon from "@/public/assets/moon.svg";
import sun from "@/public/assets/sun.svg";

interface HeaderProps {
  toggleTheme: () => void;
  darkMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleTheme, darkMode }) => {
  return (
    <header className="bg-[#c2e6ec] border-b-[#82BEE9] border-[1px] flex flex-row-reverse">
      <div className="flex items-center text-right m-2">
        <div className="flex flex-col mr-4">
          <p className="text-lg font-medium text-gray-900">Sam Doe</p>
          <p className="text-sm text-gray-500">samdoe@vitstudent.ac.in</p>
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

