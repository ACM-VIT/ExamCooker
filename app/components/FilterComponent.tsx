"use client";

import React, { useState, useEffect, useCallback } from 'react';
import FilterComp from './filter/FilterComp';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useRouter, useSearchParams } from 'next/navigation';

interface Option {
  id: string;
  label: string;
}

interface CheckboxOptions {
  courses?: Option[];
  slots?: Option[];
  years?: Option[];
}

interface DropdownProps {
  pageType: 'notes' | 'past_papers' | 'resources' | 'forum' | 'favourites';
}

const Dropdown: React.FC<DropdownProps> = ({ pageType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tags = searchParams.getAll('tags');
    if (tags.length > 0) {
      setSelectedTags(tags);
    } else {
      setSelectedTags([]);
    }
  }, [searchParams]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const checkboxOptions: CheckboxOptions = {
    courses: [
      { id: 'option1', label: 'BENG101L' },
      { id: 'option2', label: 'BEEE101L' },
      { id: 'option3', label: 'BPHY101L' },
      { id: 'option4', label: 'BCHEM101L' },
      { id: 'option5', label: 'BMAT101L' },
      { id: 'option6', label: 'BSTS101L' },
    ],
    slots: [
      { id: 'option1', label: 'D2+TD2' },
      { id: 'option2', label: 'A1' },
      { id: 'option3', label: 'B1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
      { id: 'option4', label: 'F1+TF1' },
    ],
    years: [
      { id: 'option1', label: '2024' },
      { id: 'option2', label: '2023' },
      { id: 'option3', label: '2022' },
      { id: 'option4', label: '2021' },
    ],
  };

  const handleSelectionChange = useCallback((category: keyof CheckboxOptions, selection: string[]) => {
    const newTags = Array.from(new Set([
      ...selectedTags.filter(tag => !checkboxOptions[category]?.some(option => option.label === tag)),
      ...selection
    ]));
    setSelectedTags(newTags);
    updateURL(newTags);
  }, [selectedTags, checkboxOptions]);

  const updateURL = useCallback((tags: string[]) => {
    const params = new URLSearchParams(searchParams);
    params.delete('tags');
    tags.forEach(tag => params.append('tags', tag));
    const newURL = `/${pageType}?${params.toString()}`;
    router.push(newURL);
  }, [searchParams, router, pageType]);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={toggleDropdown}
        className="inline-flex items-center justify-center w-full border-black dark:border-[#D5D5D5] border-2 text-lg font-bold px-4 py-2 bg-[#5FC4E7] dark:bg-[#7D7467]/20"
      >
        Filter
        <FontAwesomeIcon icon={faCaretDown} className="ml-2" />
      </button>

      <div className={`absolute left-0 mt-2 max-w-[90vw] sm:max-w-[400px] md:max-w-[600px] lg:max-w-[1200px] h-auto border-2 border-black 
        dark:border-[#D5D5D5] bg-[#5FC4E7] dark:bg-[#7D7467]/20 backdrop-blur-3xl overflow-y-auto z-50 ${isOpen ? '' : 'hidden'}`}>
        <div className='py-20'>
          <div className="flex flex-col sm:flex-row sm:space-x-4 justify-center items-center">
            {(Object.entries(checkboxOptions) as [keyof CheckboxOptions, Option[]][]).map(([category, options]) => (
              <div key={category} className="w-full sm:w-1/3 p-4 sm:p-2">
                <FilterComp
                  title={category.charAt(0).toUpperCase() + category.slice(1)}
                  options={options}
                  onSelectionChange={(selection) => handleSelectionChange(category, selection)}
                  selectedOptions={selectedTags.filter(tag => options.some(option => option.label === tag))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dropdown;
