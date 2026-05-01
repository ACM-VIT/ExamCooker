"use client";

import { memo, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
    BookOpen,
    FileText,
    GraduationCap,
    Layers,
    Lightbulb,
    NotebookText,
    Route,
    ScrollText,
    X,
    ChevronRight,
} from "lucide-react";
import type { StudyScope } from "@/lib/study/scope";

interface StudyLandingProps {
    scope: StudyScope | null;
    scopeLabel: string | null;
    onSend: (prompt: string) => void;
    composer: ReactNode;
}

interface ExampleItem {
    text: string;
}

interface Category {
    id: string;
    name: string;
    icon: typeof Layers;
    examples: ExampleItem[];
}

function categoriesFor(scope: StudyScope | null): Category[] {
    if (scope?.type === "NOTE") {
        return [
            {
                id: "summarize",
                name: "Summarize",
                icon: Layers,
                examples: [
                    { text: "Summarize this note into a tl;dr, sections, and key terms I should remember." },
                    { text: "Build me a one-page cheat sheet of the most important points in this note." },
                    { text: "Pull out every definition and formula in this note so I can skim them fast." },
                    { text: "Rewrite this note as a numbered study plan covering each topic in order." },
                ],
            },
            {
                id: "test",
                name: "Test me",
                icon: ScrollText,
                examples: [
                    { text: "Give me 5 exam-style MCQs from this note, with answers only after I attempt." },
                    { text: "Ask me 3 short-answer questions on the hardest parts of this note." },
                    { text: "Quiz me on every definition in this note, one at a time, and grade me." },
                    { text: "Give me a ranked list of the topics in this note I should revise first." },
                ],
            },
            {
                id: "explain",
                name: "Explain",
                icon: Lightbulb,
                examples: [
                    { text: "Find the most important concept here and explain it step by step with an example." },
                    { text: "Explain the toughest section of this note as if I am a first-year student." },
                    { text: "What background knowledge should I already have before I can follow this note?" },
                    { text: "Create a worked example for the main topic and walk me through the solution." },
                ],
            },
            {
                id: "find",
                name: "Find",
                icon: NotebookText,
                examples: [
                    { text: "Find past papers that test the concepts in this note so I can practice." },
                    { text: "Show me other notes that cover the same topic but from a different angle." },
                    { text: "Pull the official VIT syllabus pages that match this note." },
                    { text: "Find forum threads where students discussed this topic." },
                ],
            },
        ];
    }
    if (scope?.type === "PAST_PAPER") {
        return [
            {
                id: "walk",
                name: "Walk me through",
                icon: Route,
                examples: [
                    { text: "Walk me through question 1 step by step and show every assumption." },
                    { text: "Solve the hardest question on this paper and explain why each step works." },
                    { text: "Pick two representative questions and walk through both together." },
                    { text: "I will paste my attempt, grade it and tell me where I lost marks." },
                ],
            },
            {
                id: "concepts",
                name: "Concepts",
                icon: Layers,
                examples: [
                    { text: "What concepts does this paper test? Give me a prioritized checklist." },
                    { text: "Rank the topics on this paper from most to least frequent." },
                    { text: "Identify the single concept this paper leans on most heavily." },
                    { text: "Sketch a mark scheme for every question on this paper." },
                ],
            },
            {
                id: "test",
                name: "Test me",
                icon: ScrollText,
                examples: [
                    { text: "Quiz me on concepts from this paper with 5 MCQs, four options each." },
                    { text: "Give me 3 short-answer questions written in the same style as this paper." },
                    { text: "Create a harder variant of question 2 with different numbers and solve it." },
                    { text: "Run a mock exam session: ask me questions until I get 5 right in a row." },
                ],
            },
            {
                id: "similar",
                name: "Similar papers",
                icon: FileText,
                examples: [
                    { text: "Find past papers from other years for the same course and exam type." },
                    { text: "Show me CAT-1, CAT-2, and FAT papers for the same course so I can compare." },
                    { text: "Line up 3 papers from easiest to hardest for me to attempt in order." },
                    { text: "Find papers that test the same concepts but are noticeably tougher." },
                ],
            },
        ];
    }
    if (scope?.type === "COURSE") {
        return [
            {
                id: "plan",
                name: "Study plan",
                icon: Route,
                examples: [
                    { text: "Build me a 3-day study plan for this course. Use the syllabus to pick topics." },
                    { text: "Make a 7-day revision plan starting from the basics and ending with mock papers." },
                    { text: "If my exam is in 48 hours, what is the highest-yield path through this course?" },
                    { text: "Turn the syllabus into a day-by-day schedule with practice goals." },
                ],
            },
            {
                id: "overview",
                name: "Overview",
                icon: Layers,
                examples: [
                    { text: "Give me a full overview of this course: modules, core topics, and outcomes." },
                    { text: "Pull the syllabus for this course and summarize each unit." },
                    { text: "Show me how many CAT-1, CAT-2, FAT papers exist for this course." },
                    { text: "What are the recurring high-weight topics across recent papers for this course?" },
                ],
            },
            {
                id: "test",
                name: "Test me",
                icon: ScrollText,
                examples: [
                    { text: "Quiz me on the core concepts for this course with 5 MCQs." },
                    { text: "Ask me progressively harder exam-style questions about this course." },
                    { text: "Build me a mock CAT-1 paper for this course from what you know." },
                    { text: "Run a doubt-clearing round: ask me what I do not understand yet." },
                ],
            },
            {
                id: "materials",
                name: "Materials",
                icon: FileText,
                examples: [
                    { text: "Pull every past paper for this course grouped by year and exam type." },
                    { text: "Show me the most recent CAT and FAT papers for this course." },
                    { text: "Find the most upvoted notes for this course." },
                    { text: "Point me to forum threads about this course and summarize the top ones." },
                ],
            },
        ];
    }
    return [
        {
            id: "explain",
            name: "Explain",
            icon: Lightbulb,
            examples: [
                { text: "Explain a VIT CS concept I am struggling with. Ask me which one first." },
                { text: "Break down a topic from first principles. Ask me the topic and my background." },
                { text: "Teach me a concept by building up from simpler ideas, one layer at a time." },
                { text: "Compare two related concepts side by side. Ask me which two." },
            ],
        },
        {
            id: "test",
            name: "Test me",
            icon: ScrollText,
            examples: [
                { text: "Quiz me on a topic. Ask me the subject and chapter first." },
                { text: "Give me 5 progressively harder MCQs on a topic I pick." },
                { text: "Run a flashcard session on a subject I choose." },
                { text: "Make a practice question, grade my answer, and repeat until I say stop." },
            ],
        },
        {
            id: "plan",
            name: "Plan",
            icon: Route,
            examples: [
                { text: "Help me plan a revision schedule. Ask about my exams and days remaining." },
                { text: "Turn my weak topics into a week of study tasks with daily goals." },
                { text: "Give me a morning routine for exam week." },
                { text: "Suggest what to study each day until my next CAT for a course I pick." },
            ],
        },
        {
            id: "find",
            name: "Find",
            icon: NotebookText,
            examples: [
                { text: "Help me find study material. Ask me the course code." },
                { text: "Find past papers for a course. Ask me the course and exam type." },
                { text: "Point me to the most useful notes for a course I choose." },
                { text: "Show me the most active forum threads for my courses." },
            ],
        },
    ];
}

function scopeKind(type: StudyScope["type"]) {
    if (type === "NOTE") return { label: "Note", Icon: BookOpen };
    if (type === "PAST_PAPER") return { label: "Past paper", Icon: FileText };
    return { label: "Course", Icon: GraduationCap };
}

export const StudyLanding = memo(function StudyLanding({
    scope,
    scopeLabel,
    onSend,
    composer,
}: StudyLandingProps) {
    const categories = categoriesFor(scope);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleCategoryClick = useCallback((id: string) => {
        setSelectedCategory((prev) => (prev === id ? null : id));
    }, []);

    const handleSelect = useCallback(
        (text: string) => {
            onSend(text);
            setSelectedCategory(null);
        },
        [onSend]
    );

    useEffect(() => {
        if (!selectedCategory) return;
        const onClick = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                setSelectedCategory(null);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedCategory(null);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [selectedCategory]);

    const active = categories.find((c) => c.id === selectedCategory);
    const scopeMeta = scope ? scopeKind(scope.type) : null;

    return (
        <div className="flex w-full flex-col items-center gap-6 text-center">
            {scope && scopeLabel && scopeMeta && (
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[12px] font-medium text-black shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-[#D5D5D5]">
                    <scopeMeta.Icon className="h-3.5 w-3.5 shrink-0 text-black/55 dark:text-[#D5D5D5]/55" strokeWidth={1.75} />
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-black/50 dark:text-[#D5D5D5]/50">
                        {scopeMeta.label}
                    </span>
                    <span className="mx-0.5 text-black/20 dark:text-[#D5D5D5]/20">·</span>
                    <span className="truncate">{scopeLabel}</span>
                </div>
            )}

            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-[#D5D5D5]">
                    {scope ? "What do you want to know?" : "What should we study?"}
                </h1>
                <p className="mt-2 text-[13.5px] text-black/60 dark:text-[#D5D5D5]/60">
                    {scope
                        ? "Ask anything — the document is loaded in context."
                        : "Ask about your coursework, past papers, notes, or any concept."}
                </p>
            </div>

            <div className="w-full max-w-xl">{composer}</div>

            <div className="relative w-full max-w-xl">
                <div
                    className={[
                        "flex flex-wrap items-center justify-center gap-2 transition-opacity duration-150",
                        selectedCategory ? "opacity-0 pointer-events-none" : "opacity-100",
                    ].join(" ")}
                >
                    {categories.map((c) => (
                        <motion.button
                            key={c.id}
                            onClick={() => handleCategoryClick(c.id)}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/75 transition-colors hover:border-black/20 hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/5 dark:text-[#D5D5D5]/80 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-[#D5D5D5]"
                        >
                            <c.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span>{c.name}</span>
                        </motion.button>
                    ))}
                </div>

                <AnimatePresence>
                    {active && (
                        <motion.div
                            ref={cardRef}
                            key={active.id}
                            initial={{ opacity: 0, scale: 0.98, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: -4 }}
                            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-x-0 top-0 z-10 overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111826]"
                        >
                            <button
                                type="button"
                                onClick={() => setSelectedCategory(null)}
                                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <active.icon className="h-4 w-4 text-black/60 dark:text-[#D5D5D5]/60" strokeWidth={1.75} />
                                    <span className="text-[13px] font-semibold text-black dark:text-[#D5D5D5]">
                                        {active.name}
                                    </span>
                                </div>
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/5 text-black/60 dark:bg-white/10 dark:text-[#D5D5D5]/60">
                                    <X className="h-3 w-3" />
                                </span>
                            </button>
                            <div className="border-t border-black/5 p-1.5 dark:border-white/5">
                                {active.examples.map((example) => (
                                    <button
                                        key={example.text}
                                        onClick={() => handleSelect(example.text)}
                                        className="group flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-black/70 transition-colors hover:bg-black/[0.04] hover:text-black dark:text-[#D5D5D5]/75 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                                    >
                                        <span className="line-clamp-2">{example.text}</span>
                                        <ChevronRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-50" />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});
