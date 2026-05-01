"use client";

import Link from "next/link";
import Image from "@/app/components/common/AppImage";
import LogoIcon from "@/public/assets/LogoIcon.svg";

export function SidebarWordmark({
    href = "/home",
    align = "start",
}: {
    href?: string;
    align?: "start" | "end";
}) {
    return (
        <Link
            href={href}
            className={[
                "flex min-w-0 items-center gap-1.5",
                align === "end" ? "w-full justify-end text-right" : "",
            ].join(" ")}
            aria-label="ExamCooker home"
        >
            <Image src={LogoIcon} alt="" width={22} height={22} className="shrink-0" />
            <span
                className={[
                    "truncate text-[15px] font-extrabold leading-none text-black dark:text-[#D5D5D5]",
                    align === "end" ? "text-right" : "",
                ].join(" ")}
            >
                Exam
                <span className="bg-gradient-to-tr from-[#253EE0] to-[#27BAEC] bg-clip-text text-transparent">
                    Cooker
                </span>
            </span>
        </Link>
    );
}
