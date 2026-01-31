import React from "react";

export default function Loading() {
    return (
        <div className="min-h-screen text-black dark:text-gray-200 flex flex-col items-center justify-start p-8">
            <h1 className="text-center mb-4">Syllabus</h1>

            <div className="w-full max-w-3xl mb-6 sm:mb-8 pt-2">
                <div className="h-10 bg-[#5FC4E7]/40 dark:bg-[#ffffff]/5 border-2 border-transparent animate-pulse rounded" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-[90vw]">
                {Array.from({ length: 16 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-24 bg-[#5FC4E7]/40 dark:bg-[#ffffff]/5 border-2 border-transparent animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}
