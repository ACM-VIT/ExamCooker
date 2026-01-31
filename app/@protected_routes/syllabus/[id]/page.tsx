import React from 'react';
import PDFViewerClient from '@/app/components/PDFViewerClient';
import { notFound } from "next/navigation";
import ViewTracker from "@/app/components/ViewTracker";
import { getSyllabusDetail } from "@/lib/data/syllabusDetail";

function processSyllabusName(input: string): string {
    return input
      .slice(9) 
      .replace(/\.pdf$/, '') 
      .replace(/_/g, ' '); 
  }

async function SyllabusViewerPage({ params }: { params: Promise<{ id: string }> }) {
    let syllabus;
    const { id } = await params;

    try {
        syllabus = await getSyllabusDetail(id);

    } catch (error) {
        console.error('Error fetching syllabus:', error);
        return (
            <div>
                <div className="text-center p-8 dark:text-[#d5d5d5]">
                    Error loading syllabus. Please refresh, or try again later.
                </div>
            </div>
        );
    } finally {
        // no-op
    }

    if (!syllabus) {
        return notFound();
    }

    //const postTime: string = syllabus.createdAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    return (
        <div className="flex flex-col lg:flex-row h-screen text-black dark:text-[#D5D5D5]">
            <ViewTracker
                id={syllabus.id}
                type="syllabus"
                title={processSyllabusName(syllabus.name)}
            />
            <div className="lg:w-1/2 flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{processSyllabusName(syllabus.name)}</h1>
                        <div className="space-y-2 sm:space-y-3">
                            <div className="flex gap-2 items-center">
                                {/* {syllabus.author?.id === userId &&
                                    <DeleteButton itemID={syllabus.id} activeTab='syllabi'/>
                                } */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 lg:w-1/2 overflow-hidden lg:border-l lg:border-black dark:lg:border-[#D5D5D5] p-4">
                <div className="h-full overflow-auto">
                    <PDFViewerClient fileUrl={syllabus.fileUrl} />
                </div>
            </div>
        </div>
    );
}

export default SyllabusViewerPage;
