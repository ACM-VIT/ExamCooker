"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import NothingViewedOrFavSvg from "@/public/assets/nothingviewedorfav.svg";

export default function NothingViewedOrFav({ sectionName }: { sectionName: string }) {
    const label = sectionName === "Favourites" ? "favourited" : "viewed";
    return (
        <div
            className="flex flex-col border rounded-lg w-full
            p-4 md:p-6 border-[#82BEE9] dark:border-[#D5D5D5]
            items-center text-center"
        >
            <Image
                src={NothingViewedOrFavSvg}
                alt="Nothing Viewed Or Favourited"
                className="h-[80px] md:h-[100px] mb-4"
            />
            <div className="flex flex-col gap-2 justify-center">
                <h3 className="text-lg font-semibold">You have not {label} anything</h3>
                <div className="space-y-2">
                    <div
                        className="flex flex-wrap gap-1 p-2 bg-[#E2E8F0] text-sm
                        dark:bg-[#232530] rounded-lg justify-center items-center"
                    >
                        <Link href="/past_papers" className="px-2 py-1 hover:bg-white/20 rounded">
                            Papers
                        </Link>
                        <span className="text-gray-500">|</span>
                        <Link href="/notes" className="px-2 py-1 hover:bg-white/20 rounded">
                            Notes
                        </Link>
                        <span className="text-gray-500">|</span>
                        <Link href="/forum" className="px-2 py-1 hover:bg-white/20 rounded">
                            Forum
                        </Link>
                        <span className="text-gray-500">|</span>
                        <Link href="/syllabus" className="px-2 py-1 hover:bg-white/20 rounded">
                            Syllabus
                        </Link>
                        <span className="text-gray-500">|</span>
                        <Link href="/resources" className="px-2 py-1 hover:bg-white/20 rounded">
                            Resources
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
