"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, handleClickOutside]);

    const checkboxOptions: CheckboxOptions = {
        // courses: [
        //     { id: 'option1', label: 'BENG101L' },
        //     { id: 'option2', label: 'BEEE101L' },
        //     { id: 'option3', label: 'BPHY101L' },
        //     { id: 'option4', label: 'BCHEM101L' },
        //     { id: 'option5', label: 'BMAT101L' },
        //     { id: 'option6', label: 'BSTS101L' },
        // ],

        slots: [
            { id: 'A1', label: 'A1' },
            { id: 'A2', label: 'A2' },
            { id: 'B1', label: 'B1' },
            { id: 'B2', label: 'B2' },
            { id: 'C1', label: 'C1' },
            { id: 'C2', label: 'C2' },
            { id: 'D1', label: 'D1' },
            { id: 'D2', label: 'D2' },
            { id: 'E1', label: 'E1' },
            { id: 'E2', label: 'E2' },
            { id: 'F1', label: 'F1' },
            { id: 'F2', label: 'F2' },
            { id: 'G1', label: 'G1' },
            { id: 'G2', label: 'G2' },
        ],
        //     years: [
        //         { id: 'option1', label: '2024' },
        //         { id: 'option2', label: '2023' },
        //         { id: 'option3', label: '2022' },
        //         { id: 'option4', label: '2021' },
        //     ],

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
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                className="inline-flex items-center justify-center w-full border-black dark:border-white border-2 text-lg font-bold px-4 py-2 bg-[#5FC4E7] dark:bg-[#7D7467]/20"
            >
                Filter
                <FontAwesomeIcon icon={faCaretDown} className="ml-2" />
            </button>

            <div className={`hide-scrollbar flex flex-col sm:flex-row sm:space-x-4 justify-center items-start absolute left-0 mt-2 w-full w-[45vw] sm:w-auto sm:max-w-[1200px] border-2 border-black dark:border-white bg-[#4AD0FF] dark:bg-[#232530] z-50 overflow-auto ${isOpen ? '' : 'hidden'}`}>
                {checkboxOptions.slots && (
                    <div className="w-full p-4 sm:p-2 flex flex-wrap justify-center font-bold">
                        <FilterComp
                            title="Slots"
                            options={checkboxOptions.slots}
                            onSelectionChange={(selection) => handleSelectionChange('slots', selection)}
                            selectedOptions={selectedTags.filter(tag => checkboxOptions.slots!.some(option => option.label === tag))}
                            isSlotCategory={true}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dropdown;
