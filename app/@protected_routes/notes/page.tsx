import React, { Suspense } from 'react';
import Link from "next/link";
import { redirect } from 'next/navigation';
import type { Metadata } from "next";
import Pagination from "../../components/Pagination";
import NotesCard from "../../components/NotesCard";
import SearchBar from "../../components/SearchBar";
import Dropdown from "../../components/FilterComponent";
import UploadButtonNotes from "../../components/UploadButtonNotes";
import { getNotesCount, getNotesPage } from "@/lib/data/notes";
import { buildKeywords, DEFAULT_KEYWORDS } from "@/lib/seo";
import { extractCourseFromTag } from "@/lib/courseTags";

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

function NotesSkeleton() {
    return (
        <div className="flex justify-center">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6 place-content-center">
                {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="max-w-sm w-full h-full">
                        <div className="hover:shadow-xl px-5 py-6 w-full text-center bg-[#5FC4E7]/40 dark:bg-[#ffffff]/5 lg:dark:bg-[#0C1222] dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 border-2 border-transparent transition duration-200 transform max-w-96">
                            <div className="bg-[#d9d9d9]/70 w-full h-44 relative overflow-hidden animate-pulse" />
                            <div className="flex justify-between items-center mt-3">
                                <div />
                                <div className="h-4 w-2/3 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                                <div className="h-4 w-4 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

async function NotesResults({ params }: { params: { page?: string; search?: string; tags?: string | string[] } }) {
    const pageSize = 9;
    const search = params.search || '';
    const page = parseInt(params.page || '1', 10);
    const tags: string[] = Array.isArray(params.tags)
        ? params.tags
        : (params.tags ? params.tags.split(',') : []);
    const normalizedTags = [...tags].sort();

    const totalCount = await getNotesCount({
        search,
        tags: normalizedTags,
    });
    const totalPages = Math.ceil(totalCount / pageSize);
    const validatedPage = validatePage(page, totalPages);
    const paginatedNotes = await getNotesPage({
        search,
        tags: normalizedTags,
        page: validatedPage,
        pageSize,
    });

    if (validatedPage !== page) {
        const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
        const tagsQuery = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
        redirect(`/notes?page=${validatedPage}${searchQuery}${tagsQuery}`);
    }

    return (
        <>
            {tags.length > 0 && (
                <div className="flex justify-center mb-4">
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag, index) => {
                            const course = extractCourseFromTag(tag);
                            if (course) {
                                return (
                                    <Link
                                        key={`${tag}-${index}`}
                                        href={`/courses/${encodeURIComponent(course.code)}`}
                                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded"
                                    >
                                        {tag}
                                    </Link>
                                );
                            }
                            return (
                                <span key={`${tag}-${index}`} className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {tag}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className='flex justify-center'>
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6 place-content-center">
                    {paginatedNotes.length > 0 ? (
                        paginatedNotes.map((eachNote, index) => (
                            <NotesCard
                                key={eachNote.id}
                                note={eachNote}
                                index={index}
                            />
                        ))
                    ) : (
                        <p className="col-span-3 text-center">
                            {search || tags.length > 0
                                ? "No notes found matching your search or selected tags."
                                : "No notes found."}
                        </p>
                    )}
                </div>
            </div>

            {totalPages > 1 && (
                <div className="mt-auto">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/notes"
                        searchQuery={search}
                        tagsQuery={tags.join(',')}
                    />
                </div>
            )}
        </>
    );
}

export default async function NotesPage({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string; tags?: string | string[] }>;
}) {
    const params = (await searchParams) ?? {};
    const search = params.search || '';
    return (
        <div className="p-8 transition-colors flex flex-col min-h-screen items-center text-black dark:text-[#D5D5D5]">
            <h1 className="text-center mb-4">Notes</h1>
            <div className="hidden w-5/6 lg:w-1/2 md:flex items-center justify-center p-4 space-y-4 sm:space-y-0 sm:space-x-4 pt-2">
                <Dropdown pageType='notes' />
                <SearchBar pageType="notes" initialQuery={search} />
                <UploadButtonNotes />
            </div>

            <div className='flex-col w-5/6 md:hidden space-y-4'>
                <SearchBar pageType="notes" initialQuery={search} />
                <div className='flex justify-between'>
                    <Dropdown pageType='notes' />
                    <UploadButtonNotes />
                </div>
            </div>

            <Suspense fallback={<NotesSkeleton />}>
                <NotesResults params={params} />
            </Suspense>
        </div>
    );
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string; tags?: string | string[] }>;
}): Promise<Metadata> {
    const params = (await searchParams) ?? {};
    const search = params.search || "";
    const page = Number.parseInt(params.page || "1", 10) || 1;
    const tags: string[] = Array.isArray(params.tags)
        ? params.tags
        : (params.tags ? params.tags.split(",") : []);
    const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);
    const isIndexable = !search && normalizedTags.length === 0 && page <= 1;

    const titleParts = ["Notes"];
    if (normalizedTags.length) titleParts.push(normalizedTags.join(", "));
    if (search) titleParts.push(`matching "${search}"`);

    const title = titleParts.join(" - ");
    const description = normalizedTags.length || search
        ? `Browse notes ${normalizedTags.length ? `tagged ${normalizedTags.join(", ")}` : ""}${search ? ` matching ${search}` : ""}.`
        : "Browse VIT notes and study material on ExamCooker.";

    return {
        title,
        description,
        keywords: buildKeywords(DEFAULT_KEYWORDS, normalizedTags),
        alternates: { canonical: "/notes" },
        robots: { index: isIndexable, follow: true },
    };
}
