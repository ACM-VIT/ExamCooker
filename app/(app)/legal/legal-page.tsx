import Link from "next/link";
import type { ReactNode } from "react";
import ExamCookerLogo from "@/app/components/common/exam-cooker-logo";
import LegalSectionNav from "@/app/(app)/legal/legal-section-nav";

export type LegalSection = {
    id: string;
    title: string;
    body: Array<string | { label?: string; text: ReactNode }>;
};

type LegalPageProps = {
    title: string;
    updatedAt: string;
    sections: LegalSection[];
};

export default function LegalPage({
    title,
    updatedAt,
    sections,
}: LegalPageProps) {
    return (
        <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
                <header className="flex flex-col gap-8 border-b border-black/10 pb-10 dark:border-white/10">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <Link href="/" aria-label="ExamCooker home" className="w-fit">
                            <ExamCookerLogo />
                        </Link>
                    </div>

                    <div className="max-w-3xl">
                        <h1 className="text-4xl font-black tracking-normal text-black dark:text-[#D5D5D5] sm:text-5xl">
                            {title}
                        </h1>
                    </div>
                </header>

                <div className="grid gap-10 lg:grid-cols-[13rem_1fr] lg:gap-16">
                    <aside className="hidden lg:block">
                        <LegalSectionNav sections={sections} />
                    </aside>

                    <main className="flex min-w-0 flex-col gap-10">
                        {sections.map((section) => (
                            <section
                                key={section.id}
                                id={section.id}
                                className="scroll-mt-8 border-b border-black/10 pb-10 last:border-b-0 dark:border-white/10"
                            >
                                <h2 className="text-xl font-black tracking-normal text-black dark:text-[#D5D5D5] sm:text-2xl">
                                    {section.title}
                                </h2>
                                <div className="mt-5 flex flex-col gap-4">
                                    {section.body.map((item, index) =>
                                        typeof item === "string" ? (
                                            <p
                                                key={index}
                                                className="text-sm leading-7 text-black/70 dark:text-[#D5D5D5]/70 sm:text-base"
                                            >
                                                {item}
                                            </p>
                                        ) : item.label ? (
                                            <p
                                                key={item.label}
                                                className="text-sm leading-7 text-black/70 dark:text-[#D5D5D5]/70 sm:text-base"
                                            >
                                                <span className="font-bold text-black dark:text-[#D5D5D5]">
                                                    {item.label}
                                                </span>{" "}
                                                {item.text}
                                            </p>
                                        ) : (
                                            <p
                                                key={index}
                                                className="text-sm leading-7 text-black/70 dark:text-[#D5D5D5]/70 sm:text-base"
                                            >
                                                {item.text}
                                            </p>
                                        ),
                                    )}
                                </div>
                            </section>
                        ))}
                        <p className="text-sm font-medium text-black/55 dark:text-[#D5D5D5]/55">
                            Last updated {updatedAt}
                        </p>
                    </main>
                </div>
            </div>
        </div>
    );
}
