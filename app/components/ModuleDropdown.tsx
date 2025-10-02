"use client";

import React, { useState } from 'react';
import { Module } from '@/src/generated/prisma';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleDown } from '@fortawesome/free-solid-svg-icons';

interface ModuleDropdownProps {
    module: Module;
}

function ModuleDropdown({ module }: ModuleDropdownProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="mb-2">
            <button
                onClick={toggleExpand}
                className="flex items-center justify-between w-full text-left py-2 px-4 bg-[#82BEE9] dark:bg-[#232530]  border-b-2 hover:bg-opacity-80 hover:border-b-white hover:border-b-2 transition-colors duration-200 "
                style={{ borderBottomColor: isExpanded ? '#3BF4C7' : '' }}
            >
                <h3>{module.title}</h3>
                {isExpanded && <FontAwesomeIcon icon={faAngleDown} />}
                {!isExpanded && <FontAwesomeIcon icon={faAngleRight} />}
            </button>
            {isExpanded && (
                <div className="sm:grid sm:grid-cols-2 px-4 py-2">
                    <div>
                        <h4 className="font-bold mb-2">Web References:</h4>
                        <ul className="list-disc pl-5 mb-2">
                            {module.webReferences.map((link, index) => (
                                <li key={index} className="mb-1">
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {link}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-2">YouTube Links:</h4>
                        <ul className="list-disc pl-5">
                            {module.youtubeLinks.map((link, index) => (
                                <li key={index} className="mb-1">
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">
                                        {link}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ModuleDropdown;
