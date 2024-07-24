
"use client";
import React from 'react';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const SearchBarFilter: React.FC = () => {
  return (
    <div className="flex items-center bg-white border border-black border-2 shadow-md mb-4">
      <FontAwesomeIcon icon={faSearch} color='grey' className='ml-4' />
      <input
        type="text"
        className="px-4 py-2 focus:outline-none w-full"
        placeholder="Search"
      />
    </div>
  );
}

export default SearchBarFilter;

