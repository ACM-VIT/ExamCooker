import React from 'react';
import PDFViewerClient from '@/app/components/PDFViewerClient';
import {TimeHandler} from '@/app/components/forumpost/CommentContainer';
import {notFound} from "next/navigation";
import {Metadata} from "next";

import ShareLink from '@/app/components/ShareLink';
import ViewTracker from "@/app/components/ViewTracker";
import ItemActions from "@/app/components/ItemActions";
import { getNoteDetail } from "@/lib/data/noteDetail";
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';


function removePdfExtension(filename: string): string {
    return filename.endsWith('.pdf') ? filename.slice(0, -4) : filename;
}

function isValidSlot(str: string): boolean {
    const regex = /^[A-G]\d$/;
    return regex.test(str);
}

function isValidYear(year: string): boolean {
    const regex = /^20\d{2}$/;
    return regex.test(year);
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

    const postTime: string = note.createdAt.toLocaleString("en-US", {timeZone: "Asia/Kolkata"});

    return (
        <div className="flex flex-col lg:flex-row h-screen text-black dark:text-[#D5D5D5]">
            <ViewTracker
                id={note.id}
                type="note"
                title={removePdfExtension(note.title)}
            />
            <div className="lg:w-1/2 flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{removePdfExtension(note.title)}</h1>

                        <div className="space-y-2 sm:space-y-3">
                            <p className="text-base sm:text-lg"><span className="font-semibold">Slot:</span> {slot}</p>
                            <p className="text-base sm:text-lg"><span className="font-semibold">Year:</span> {year}</p>
                            <p className="text-base sm:text-lg"><span
                                className="font-semibold">Posted by: </span> {note.author?.name?.slice(0, -10) || 'Unknown'}
                            </p>
                            <div className="flex gap-2 items-center justify-between">
                                <p className='text-base sm:text-xs'><span
                                    className="font-semibold">Posted at: {TimeHandler(postTime).hours}:{TimeHandler(postTime).minutes}{TimeHandler(postTime).amOrPm}, {TimeHandler(postTime).day}-{TimeHandler(postTime).month}-{TimeHandler(postTime).year}</span>
                                </p>
                                <ItemActions
                                    itemId={note.id}
                                    title={note.title}
                                    authorId={note.author?.id}
                                    activeTab="notes"
                                />
                                <ShareLink fileType='these Notes'/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 lg:w-1/2 overflow-hidden lg:border-l lg:border-black dark:lg:border-[#D5D5D5] p-4">
                <div className="h-full overflow-auto">
                    <PDFViewerClient fileUrl={note.fileUrl}/>
                </div>
            </div>
        </div>
    );

}

export default PdfViewerPage;

// nextjs metadata

export async function generateMetadata({params}: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const note = await getNoteDetail(id);
    if (!note) return {}
    return {
        title: removePdfExtension(note.title),
        openGraph: {
            images: note.thumbNailUrl ? [{url: note.thumbNailUrl}] : []
        },
        keywords: ['vit', 'previous year question papers', 'pdf', 'notes', 'question papers', 'exam', 'examcooker', ...note.tags.map(tag => tag.name)]
    }
}
