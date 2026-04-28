import React from 'react';
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PDFViewerClient from '@/app/components/PDFViewerClient';
import {notFound} from "next/navigation";
import {Metadata} from "next";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import StructuredData from "@/app/components/seo/StructuredData";

import ShareLink from '@/app/components/ShareLink';
import ViewTracker from "@/app/components/ViewTracker";
import ItemActions from "@/app/components/ItemActions";
import { getNoteDetail } from "@/lib/data/noteDetail";
import { absoluteUrl, buildKeywords, DEFAULT_KEYWORDS, getCourseNotesPath } from "@/lib/seo";
import { buildNotePdfFileName } from "@/lib/downloads/resourceNames";
import { stripPdfExtension } from "@/lib/pdf";
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

function isValidSlot(str: string): boolean {
    const regex = /^[A-G]\d$/;
    return regex.test(str);
}

function isValidYear(year: string): boolean {
    const regex = /^20\d{2}$/;
    return regex.test(year);
}

function formatPostedAt(date: Date) {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

async function PdfViewerPage({params}: { params: Promise<{ id: string }> }) {
    let year: string = '';
    let slot: string = '';
    let note;
    const { id } = await params;

    try {
        note = await getNoteDetail(id);

        if (note) {
            for (let i: number = 0; i < note!.tags.length; i++) {
                if (isValidYear(note!.tags[i].name)) {
                    year = note!.tags[i].name
                } else if (isValidSlot(note!.tags[i].name)) {
                    slot = note!.tags[i].name
                }
            }
        }

    } catch (error) {
        console.error('Error fetching note:', error);
        return (
            <div>
                <div className="text-center p-8 dark:text-[#d5d5d5]">Error loading note. Please refresh, or try again
                    later.
                </div>
                {/* <div><FontAwesomeIcon icon={faArrowLeft}/>Go Back</div> */}
            </div>
        );
    } finally {
        // no-op
    }

    if (!note) {
        return notFound();
    }
    const title = stripPdfExtension(note.title);
    const canonical = `/notes/${note.id}`;
    const postedAtLine = formatPostedAt(note.createdAt);
    const authorName = note.author?.name?.slice(0, -10) || "Unknown";
    const backHref = note.course?.code ? getCourseNotesPath(note.course.code) : "/notes";
    const backLabel = note.course?.code ?? "Notes";
    const downloadFileName = buildNotePdfFileName({
        courseCode: note.course?.code,
        courseTitle: note.course?.title,
        title: note.title,
    });
    const metaPills: Array<{ label: string; value: string }> = [];
    if (slot) metaPills.push({ label: "Slot", value: slot });
    if (year) metaPills.push({ label: "Year", value: year });
    note.tags
        .filter((tag) => tag.name !== slot && tag.name !== year)
        .slice(0, 4)
        .forEach((tag) => metaPills.push({ label: "Tag", value: tag.name }));
    const keywords = buildKeywords(
        DEFAULT_KEYWORDS,
        note.tags.map((tag) => tag.name)
    );
    const description = `View ${title} notes on ExamCooker.`;
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: title,
        description,
        url: absoluteUrl(canonical),
        datePublished: note.createdAt.toISOString(),
        dateModified: note.updatedAt.toISOString(),
        keywords: keywords.join(", "),
        author: note.author?.name ? { "@type": "Person", name: note.author.name } : undefined,
    };

    return (
        <DirectionalTransition>
            <div className="min-h-dvh bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <StructuredData data={jsonLd} />
                <ViewTracker
                    id={note.id}
                    type="note"
                    title={title}
                />

                <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10">
                    <Link
                        href={backHref}
                        transitionTypes={["nav-back"]}
                        className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-black/55 hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
                    >
                        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
                        <span>Back to {backLabel}</span>
                    </Link>

                    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-pretty text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
                                {title}
                            </h1>
                            {metaPills.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {metaPills.map(({ label, value }) => (
                                        <span
                                            key={`${label}-${value}`}
                                            className="inline-flex items-center gap-1.5 border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                                        >
                                            <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                                                {label}
                                            </span>
                                            <span>{value}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <p className="mt-3 text-xs text-black/55 dark:text-[#D5D5D5]/55">
                                Posted by <span className="font-semibold text-black/75 dark:text-[#D5D5D5]/75">{authorName}</span>
                                <span className="mx-1.5" aria-hidden>·</span>
                                {postedAtLine}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:pt-1">
                            <ItemActions
                                itemId={note.id}
                                title={note.title}
                                authorId={note.author?.id}
                                activeTab="notes"
                            />
                            <ShareLink fileType="these Notes" />
                        </div>
                    </header>

                    <div className="overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
                        <div className="h-[70dvh] sm:h-[78dvh] lg:h-[84dvh] xl:h-[86dvh]">
                            <PDFViewerClient
                                fileUrl={note.fileUrl}
                                fileName={downloadFileName}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </DirectionalTransition>
    );

}

export default PdfViewerPage;

// nextjs metadata

export async function generateMetadata({params}: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const note = await getNoteDetail(id);
    if (!note) return {}
    const title = stripPdfExtension(note.title);
    const canonical = `/notes/${note.id}`;
    const description = `View ${title} notes on ExamCooker.`;
    const keywords = buildKeywords(
        DEFAULT_KEYWORDS,
        note.tags.map((tag) => tag.name)
    );
    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: canonical,
            images: note.thumbNailUrl ? [{url: note.thumbNailUrl}] : []
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: note.thumbNailUrl ? [note.thumbNailUrl] : [],
        },
        alternates: { canonical },
        keywords,
        robots: { index: true, follow: true },
    }
}
