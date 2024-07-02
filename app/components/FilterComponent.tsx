
"use client";

import React, { useState } from 'react';
import FilterComp from './filter/FilterComp';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const Dropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const checkboxOptions1 = [
    { id: 'option1', label: 'BENG101L' },
    { id: 'option2', label: 'BPHY101L' },
    { id: 'option3', label: 'BCHEM101L' },
    { id: 'option4', label: 'BMAT101L' },
    { id: 'option5', label: 'BSTS101L' },
    
    
  ];
  const checkboxOptions2 = [
    { id: 'option1', label: 'D2+TD2' },
    { id: 'option2', label: 'A1' },
    { id: 'option3', label: 'B1' },
    { id: 'option4', label: 'F1+TF1' },
    
  ];
  const checkboxOptions3 = [
    { id: 'option1', label: '2024' },
    { id: 'option2', label: '2023' },
    { id: 'option3', label: '2022' },
    { id: 'option4', label: '2021' },
    
  ];

  return (
    <div className="relative inline-block text-left ml-4">
      <button
        onClick={toggleDropdown}
        className="inline-flex items-center justify-center w-full border border-black px-4 py-2 bg-[#5FC4E7] text-sm font-medium text-gray-700"
      >
        Filter
        <FontAwesomeIcon icon={faCaretDown} className="ml-2" />
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-[900px] h-[300px] border-2 border-black  bg-[#5FC4E7] ">
          <div className="py-4 px-6">
            <div className="flex space-x-4">
              <div className="w-1/3 p-4 ">
                <FilterComp title="Courses" options={checkboxOptions1} />
              </div>
              <div className="w-1/3 p-4 ">
                <FilterComp title="Slots" options={checkboxOptions2} />
              </div>
              <div className="w-1/3 p-4 ">
                <FilterComp title="Years" options={checkboxOptions3} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
