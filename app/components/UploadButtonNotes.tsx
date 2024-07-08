
'use client';
import React from 'react';
import Link from 'next/link';

const UploadButtonNotes: React.FC = () => {
    return (
        <div className="relative group inline-flex items-center">
            <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]"></div>
            <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
            <button type="submit" title="Create New Note" className="border-black dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-2 relative flex items-center px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                <Link href="/create-notes" className="flex items-center space-x-1">
                    <span className="text-xl">+</span>
                    <span className="text-lg">New</span>
                </Link>
            </button>
        </div>
    );
};

export default UploadButtonNotes;
