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
                            className="flex flex-col justify-between w-full h-full p-4 bg-[#5FC4E7]/40 border-2 border-transparent dark:bg-[#ffffff]/5 dark:lg:bg-[#0C1222] dark:border-[#ffffff]/20 transition-all duration-200"
                        >
                            <div className="space-y-2">
                                <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                                <div className="h-3 w-1/3 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                            </div>
                            <div className="flex justify-between mt-4">
                                <div />
                                <div className="h-4 w-4 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
