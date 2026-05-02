"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/app/components/ui/dialog";
import {
    writePersonalSchedule,
    usePersonalSchedule,
    type PersonalExamRecord,
} from "./personal-schedule";

function ScheduleTable({ exams }: { exams: { code: string; title: string; dateStr: string; timestamp: number }[] }) {
    return (
        <table className="w-full text-left text-xs text-black dark:text-[#D5D5D5]">
            <thead className="sticky top-0 bg-[#e0f2f5] dark:bg-[#1a2235] font-bold shadow-sm">
                <tr>
                    <th className="p-2.5 border-b border-black/20 dark:border-[#D5D5D5]/20">Date</th>
                    <th className="p-2.5 border-b border-black/20 dark:border-[#D5D5D5]/20">Course ID</th>
                    <th className="p-2.5 border-b border-black/20 dark:border-[#D5D5D5]/20">Course Name</th>
                </tr>
            </thead>
            <tbody>
                {exams.map((item, i) => (
                    <tr key={i} className="border-b border-black/10 dark:border-[#D5D5D5]/10 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="p-2.5 whitespace-nowrap">{item.dateStr}</td>
                        <td className="p-2.5 font-mono font-semibold text-[#0070f3] dark:text-[#3bf4c7]">{item.code}</td>
                        <td className="p-2.5 truncate max-w-[200px]" title={item.title}>{item.title}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function PersonalSchedulePrompt() {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [parsedExams, setParsedExams] = useState<{ code: string; title: string; dateStr: string; timestamp: number }[]>([]);
    const personalSchedule = usePersonalSchedule();
    const savedCount = personalSchedule ? Object.keys(personalSchedule).length : null;

    const savedExams = React.useMemo(() => {
        if (!personalSchedule || !savedCount) return null;
        return Object.entries(personalSchedule).map(([code, record]) => ({
            code,
            title: record.title || "Unknown Title",
            dateStr: record.dateStr || new Date(record.scheduledAt).toLocaleDateString(),
            timestamp: record.scheduledAt,
        })).sort((a, b) => a.timestamp - b.timestamp);
    }, [personalSchedule, savedCount]);

    // Parse input text in real-time
    useEffect(() => {
        if (!text.trim()) {
            setParsedExams([]);
            return;
        }

        const lines = text.split("\n");
        const results: { code: string; title: string; dateStr: string; timestamp: number }[] = [];
        const seenCodes = new Set<string>();

        for (const line of lines) {
            const courseCodeMatch = line.match(/\b([A-Z]{3,4}\d{3,4}[A-Z]?)\b/);
            const dateMatch = line.match(/\b(\d{2}-[A-Za-z]{3}-\d{4})\b/);

            if (courseCodeMatch && dateMatch) {
                const code = courseCodeMatch[1].toUpperCase();
                const dateStr = dateMatch[1];
                const timestamp = new Date(dateStr.replace(/-/g, " ")).getTime();

                if (!isNaN(timestamp) && !seenCodes.has(code)) {
                    let title = "Unknown Title";
                    if (line.includes("\t")) {
                        const parts = line.split("\t");
                        const codeIdx = parts.findIndex(p => p.trim() === code);
                        if (codeIdx !== -1 && codeIdx + 1 < parts.length) {
                            title = parts[codeIdx + 1].trim();
                        }
                    } else {
                        const titleMatch = line.match(new RegExp(`${code}\\s+(.*?)\\s+(?:TH|SS|LO|LT|PBL|ELA|EPJ|PJ|CBL|\\bVL\\d+)`));
                        if (titleMatch) {
                            title = titleMatch[1].trim();
                        }
                    }

                    results.push({ code, title, dateStr, timestamp });
                    seenCodes.add(code);
                }
            }
        }
        setParsedExams(results);
    }, [text]);

    const handleParseAndSave = () => {
        const schedule: Record<string, PersonalExamRecord> = {};
        for (const exam of parsedExams) {
            schedule[exam.code] = { scheduledAt: exam.timestamp, title: exam.title, dateStr: exam.dateStr };
        }
        writePersonalSchedule(schedule);
        setText("");
        setOpen(false);
    };

    const handleClearSchedule = () => {
        writePersonalSchedule({});
        setText("");
        setParsedExams([]);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    aria-label="Edit Schedule"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-black/40 hover:bg-black/10 hover:text-black dark:text-[#D5D5D5]/40 dark:hover:bg-white/10 dark:hover:text-[#D5D5D5] transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] bg-white dark:bg-[hsl(224,48%,9%)] border-black/20 dark:border-[#ffffff]/20">
                <DialogHeader className="relative pr-20">
                    <DialogTitle className="text-black dark:text-[#D5D5D5]">
                        {savedExams ? "Your Exam Schedule" : "Add Personal Exam Schedule"}
                    </DialogTitle>
                    <DialogDescription className="text-black/70 dark:text-[#D5D5D5]/70">
                        {savedExams 
                            ? "Here are your saved upcoming exams. Clear the schedule to add a new one." 
                            : "Paste your exam schedule directly from VTOP. We will extract the course codes and dates to prioritize your upcoming exams."}
                    </DialogDescription>
                    {savedExams && (
                        <button
                            type="button"
                            onClick={handleClearSchedule}
                            className="absolute right-6 top-1 text-[10px] font-bold uppercase tracking-wider text-black/40 hover:text-black/70 dark:text-[#D5D5D5]/40 dark:hover:text-[#D5D5D5]/70 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    {savedExams ? (
                        <div className="max-h-60 overflow-y-auto border border-black/20 dark:border-[#D5D5D5]/20 mt-2">
                            <ScheduleTable exams={savedExams} />
                        </div>
                    ) : (
                        <>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="1 BCSE301L Software Engineering..."
                                className="h-32 w-full resize-none border border-black/20 bg-transparent p-3 text-sm text-black outline-none placeholder:text-black/40 focus:border-black dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/40 dark:focus:border-[#D5D5D5]"
                            />
                            
                            {parsedExams.length > 0 && (
                                <div className="max-h-48 overflow-y-auto border border-black/20 dark:border-[#D5D5D5]/20">
                                    <ScheduleTable exams={parsedExams} />
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleParseAndSave}
                                disabled={parsedExams.length === 0}
                                className="flex h-11 w-full items-center justify-center border-2 border-[#5FC4E7] bg-[#5FC4E7] font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#5FC4E7]/80 disabled:opacity-50 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/20"
                            >
                                Save Schedule {parsedExams.length > 0 && `(${parsedExams.length})`}
                            </button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
