"use client";

import React, { addTransitionType, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
    count: number;
    searchString: string;
};

export default function AnswerKeyToggle({ count, searchString }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [, startTransition] = useTransition();
    const searchParams = new URLSearchParams(searchString);
    const checked = searchParams.get("answer_key") === "1";

    const onChange = (enabled: boolean) => {
        const params = new URLSearchParams(searchParams.toString());
        if (enabled) params.set("answer_key", "1");
        else params.delete("answer_key");
        params.delete("page");

        const qs = params.toString();
        startTransition(() => {
            addTransitionType("filter-results");
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        });
    };

    if (count <= 0) return null;

    return (
        <label className="inline-flex items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                Answer Key
            </span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-4 w-4 accent-[#5FC4E7]"
            />
        </label>
    );
}
