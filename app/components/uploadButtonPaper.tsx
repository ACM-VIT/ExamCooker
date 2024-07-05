
'use client';
import React from 'react';
import Link from 'next/link';

const UploadButtonPaper: React.FC = () => {
    return (
        <div className="relative group">
            <div className="absolute inset-0 bg-black">
            </div>
            <button type="submit" title="Login With Google " className="border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                <Link
                    href="/create-papers"
                >
                    + New
                </Link>
            </button>
        </div>


    );
};

export default UploadButtonPaper;
