'use client';

import React, {Dispatch, SetStateAction, useEffect, useMemo} from 'react';
import Fuse from "fuse.js";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons';

const slots = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2'];

const filterYearAndSlot = (tags: string[]) => {
    const yearRegex = /^(2\d{3}|3000)$/;
    return tags.filter(tag => !yearRegex.test(tag) && !slots.includes(tag));
};

function TagsInput({allTags, selectedTags, setSelectedTags}: {
    allTags: string[],
    selectedTags: string[],
    setSelectedTags: Dispatch<SetStateAction<string[]>>
}) {
    const [input, setInput] = React.useState('');
    const [showDropdown, setShowDropdown] = React.useState(false);
    const [filteredTags, setFilteredTags] = React.useState<string[]>([]);

    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const tagList = useMemo(() => {
        return filterYearAndSlot(allTags)
    }, [allTags])

    const addTag = (tag: string) => {
        setSelectedTags([...selectedTags, tag]);
    }

    const removeTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    }

    const fuse = useMemo(() => new Fuse(tagList, {
        threshold: 0.6,
        minMatchCharLength: 2,
    }), [tagList]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    useEffect(() => {
        if (input) {
            const results = fuse.search(input);
            setFilteredTags(results.map(result => result.item));
        } else {
            setFilteredTags(tagList);
        }
    }, [fuse, input])


    return (
        <div className="mb-4">
            <div className="flex items-center mb-2 flex-wrap w-full">
                {selectedTags.map((tag) => (
                    <span
                        key={tag}
                        className="inline-block bg-white dark:bg-[#3F4451] px-3 py-1 text-xs font-semibold mr-2 mb-2"
                    >
                                    #{tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-2 text-red-500"
                        >
                                        <FontAwesomeIcon icon={faCircleXmark} />
                                    </button>
                                </span>
                ))}
                <div ref={dropdownRef} className="relative w-full">
                    <input
                        type="text"
                        placeholder="Add tag"
                        className={`p-2 border-2 border-dashed border-gray-300 w-full dark:bg-[#0C1222] text-lg font-bold`}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!filteredTags.length) return;
                                addTag(filteredTags[0]);
                                setInput('');
                            }
                        }}
                        onFocus={() => setShowDropdown(true)}
                    />
                    {showDropdown && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#232530] shadow-lg max-h-60 py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                            {filteredTags.filter(i=> !selectedTags.includes(i)).map((tag) => (
                                <div
                                    key={tag}
                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[#ffffff]/10"
                                    onClick={() => addTag(tag)}
                                >
                                    {tag}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>);
}

export default TagsInput;
