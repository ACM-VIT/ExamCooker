import React from "react";

export default function Loading() {
    return (
        <div className="transition-colors min-h-screen text-black dark:text-gray-200">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-center mb-8">Resource Repo</h1>

                <div className="max-w-3xl mx-auto mb-8">
                    <div className="h-10 bg-[#5FC4E7]/40 dark:bg-[#ffffff]/5 border-2 border-transparent animate-pulse rounded" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 12 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-28 bg-[#5FC4E7]/40 dark:bg-[#ffffff]/5 border-2 border-transparent animate-pulse"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
