import React from 'react';

interface HeaderProps {
  toggleTheme: () => void;
  darkMode: boolean; // Ensure darkMode prop is included
}

const Header: React.FC<HeaderProps> = ({ toggleTheme, darkMode }) => {
  return (
    <header className="bg-[#5fc4e7] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center text-right ml-auto">
            <div className="flex flex-col mr-4">
              <p className="text-lg font-medium text-gray-900">Sam Doe</p>
              <p className="text-sm text-gray-500">samdoe@vitstudent.ac.in</p>
            </div>
            <div className="w-10 h-10 bg-gray-300 rounded-full sm:mr-4"></div>
            <button className="ml-4 px-3 py-1 rounded sm:ml-6" onClick={toggleTheme}>
              {darkMode ? '☀️' : '🌙'} {/* Toggle symbol based on darkMode state */}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
