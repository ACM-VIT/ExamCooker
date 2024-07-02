"use client";

import React, { useState } from 'react';
import { Module } from '@prisma/client';

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
                className="w-full text-left py-2 px-4 bg-blue-300 hover:bg-blue-200 transition-colors duration-200 rounded-md"
            >
                <h3 className="text-lg font-semibold">{module.title}</h3>
            </button>
            {isExpanded && (
                <div className="pl-4 pt-2">
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
            )}
        </div>
    );
}

export default ModuleDropdown;
