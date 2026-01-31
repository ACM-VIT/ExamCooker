"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import NothingViewedOrFavSvg from "@/public/assets/nothingviewedorfav.svg";

export default function NothingViewedOrFav({ sectionName }: { sectionName: string }) {
    const label = sectionName === "Favourites" ? "favourited" : "viewed";
    return (
        <div
            className="flex flex-col md:flex-row border rounded-lg w-fit md:w-2/3
            p-2 md:p-10 border-[#82BEE9] dark:border-[#D5D5D5]
            justify-evenly items-center md:items-start"
        >
            <Image
                src={NothingViewedOrFavSvg}
                alt="Nothing Viewed Or Favourited"
                className="h-[100px] md:h-[150px] lg:h-[150px]"
            />
            <div className="flex flex-col gap-2 justify-center">
                <h3>You have not {label} anything</h3>
                <div className="space-y-2">
                    <p>Go to:</p>
                    <div
                        className="flex *:px-1 p-2 bg-[#82BEE9] text-sm md:text-base
                        dark:bg-[#232530] rounded-lg *:rounded-md justify-between
                        md:justify-center w-full md:w-fit items-center"
                    >
                        <Link href={"/past_papers"} className="bg-inherit hover:bg-white/10 ">
                            Papers
                        </Link>
                        <p>|</p>
                        <Link href={"/notes"} className="bg-inherit hover:bg-white/10">
                            Notes
                        </Link>
                        <p>|</p>
                        <Link href={"/forum"} className="bg-inherit hover:bg-white/10">
                            Forum
                        </Link>
                        <p>|</p>
                        <Link href={"/syllabus"} className="bg-inherit hover:bg-white/10">
                            Syllabus
                        </Link>
                        <p>|</p>
                        <Link href={"/resources"} className="bg-inherit hover:bg-white/10">
                            Resources
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
