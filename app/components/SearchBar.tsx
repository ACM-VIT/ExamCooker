// All of the following code is dummy, boilerplate. Replace with relevant material.

// components/SearchComponent.tsx
import React from 'react';

const SearchBar: React.FC = () => {
  return (
    <div className="relative w-[75vw]">
      <input
        type="text"
        placeholder="Search..."
        className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring focus:border-blue-500"
      />
      <button className=" absolute top-0 right-0 px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:bg-blue-600">Search</button>
    </div>
  );
};

export default SearchBar;


