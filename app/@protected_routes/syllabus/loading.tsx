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
                        className="flex flex-col justify-start w-full h-full p-4 bg-[#5FC4E7]/40 border-2 border-transparent dark:bg-[#ffffff]/5 dark:lg:bg-[#0C1222] dark:border-[#ffffff]/20 transition-all duration-200"
                    >
                        <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                        <div className="h-3 w-1/3 bg-black/10 dark:bg-white/10 rounded animate-pulse mt-2" />
                    </div>
                ))}
            </div>
        </div>
    );
}
