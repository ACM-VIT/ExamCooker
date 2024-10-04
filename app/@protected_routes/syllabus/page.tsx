import React from 'react';
import Image from 'next/image';
import crane from '@/public/assets/crane.svg';

export default function SyllabusPage() {
    return (
        <div className="transition-colors min-h-screen text-black dark:text-gray-200 flex flex-col items-center justify-center">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
                {/* Original styling for the Syllabus heading */}
                <h1 className="text-center mb-8">Syllabus</h1>
                {/* Centered and smaller responsive image */}
                <div className="w-1/3 sm:w-1/4 lg:w-1/6 mx-auto">
                    <Image src={crane} alt="Crane" className="mx-auto" />
                </div>
                {/* "Under Construction" text */}
                <p className="text-lg sm:text-xl mt-4">Under Construction</p>
            </div>
        </div>
    );
}
