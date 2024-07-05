
'use client';
import React from 'react';
import Link from 'next/link';

const NewForumButton: React.FC = () => {
    return (
        <Link
            href="/create-forum"
            className="bg-[#3BF4C7] border-black border-2 text-black font-bold px-4 py-2  transition-colors duration-300 hover:bg-teal-500">
            + New
        </Link>
    );
};

export default NewForumButton;
