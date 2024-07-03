"use client";
import React, { useState } from 'react';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const SearchBarFilter  : React.FC = () => {
  const [query, setQuery] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  

  return (
      <div className="flex items-center bg-white border  border-black border-2  shadow-md">
        <FontAwesomeIcon icon = {faSearch} color='grey' className='ml-4' />
        <input
          type="text"
          className="px-4 py-2  focus:outline-none"
          placeholder="Search"
          
        
        />
        
      </div>
    
  );
}

export default SearchBarFilter;
