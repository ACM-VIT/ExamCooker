
'use client';
import React from 'react';
import Link from 'next/link';

const UploadButtonNotes: React.FC = () => {
    return (
        <div className="relative group inline-flex items-center">
            <div className="absolute inset-0 bg-black"></div>
            <button type="submit" title="Create New Note" className="border-black border-2 relative flex items-center px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                <Link href="/create-notes" className="flex items-center space-x-1">
                    <span className="text-xl">+</span>
                    <span className="text-lg">New</span>
                </Link>
            </button>
        </div>
    );
};

export default UploadButtonNotes;
