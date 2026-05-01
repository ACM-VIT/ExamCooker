"use client";

import { useEffect, useState } from "react";
import type { LegalSection } from "@/app/(app)/legal/legal-page";

function getActiveSectionId(sectionIds: string[]) {
    if (typeof window === "undefined" || sectionIds.length === 0) {
        return sectionIds[0] ?? "";
    }

    const scrollY = window.scrollY;
    const activationLine = scrollY + Math.min(window.innerHeight * 0.28, 220);
    const documentBottom = document.documentElement.scrollHeight - window.innerHeight;

    if (scrollY >= documentBottom - 4) {
        return sectionIds[sectionIds.length - 1] ?? "";
    }

    let activeId = sectionIds[0] ?? "";

    for (const sectionId of sectionIds) {
        const element = document.getElementById(sectionId);
        if (!element) continue;

        const sectionTop = element.getBoundingClientRect().top + scrollY;
        if (sectionTop <= activationLine) {
            activeId = sectionId;
        } else {
            break;
        }
    }

    return activeId;
}

export default function LegalSectionNav({
    sections,
}: {
    sections: Pick<LegalSection, "id" | "title">[];
}) {
    const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

    useEffect(() => {
        if (sections.length === 0) return;

        const sectionIds = sections.map((section) => section.id);
        let frame = 0;

        const updateActiveSection = () => {
            frame = 0;
            setActiveId(getActiveSectionId(sectionIds));
        };

        const scheduleUpdate = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(updateActiveSection);
        };

        updateActiveSection();
        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);
        window.addEventListener("hashchange", scheduleUpdate);

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", scheduleUpdate);
            window.removeEventListener("resize", scheduleUpdate);
            window.removeEventListener("hashchange", scheduleUpdate);
        };
    }, [sections]);

    return (
        <nav className="sticky top-8 flex flex-col gap-3 border-l border-black/10 pl-4 text-sm dark:border-white/10">
            {sections.map((section) => {
                const isActive = activeId === section.id;
                return (
                    <a
                        key={section.id}
                        href={`#${section.id}`}
                        onClick={() => setActiveId(section.id)}
                        className={`transition ${
                            isActive
                                ? "font-semibold text-black dark:text-[#3BF4C7]"
                                : "text-black/55 hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#3BF4C7]"
                        }`}
                    >
                        {section.title}
                    </a>
                );
            })}
        </nav>
    );
}
