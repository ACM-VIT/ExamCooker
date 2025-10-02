import React from 'react';
import { PrismaClient } from '@/src/generated/prisma';
import PDFViewer from '@/app/components/pdfviewer';
import { auth } from '@/app/auth';
import { notFound } from "next/navigation";

const prisma = new PrismaClient();

async function getSyllabus(id: string) {
    return prisma.syllabi.findUnique({
        where: { id }
    });
}

function processSyllabusName(input: string): string {
    return input
      .slice(9) 
      .replace(/\.pdf$/, '') 
      .replace(/_/g, ' '); 
  }

async function SyllabusViewerPage({ params }: { params: Promise<{ id: string }> }) {
    const prisma = new PrismaClient();
    let syllabus;
    const session = await auth();
    const userId = session?.user?.id;
    const { id } = await params;

    try {
        syllabus = await getSyllabus(id);

        if (userId && syllabus?.id) {
            await prisma.viewHistory.upsert({
                where: {
                    userId_syllabusId: { userId, syllabusId: syllabus.id}
                },
                update: {
                    viewedAt: new Date(),
                    count: {
                        increment: 1,
                    },
                },
                create: {
                    userId,
                    syllabusId: syllabus.id,
                    viewedAt: new Date(),
                    count: 1,
                },
            });
        }
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
        await prisma.$disconnect();
    }

    if (!syllabus) {
        return notFound();
    }

    //const postTime: string = syllabus.createdAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    return (
        <div className="flex flex-col lg:flex-row h-screen text-black dark:text-[#D5D5D5]">
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
                    <PDFViewer fileUrl={syllabus.fileUrl} />
                </div>
            </div>
        </div>
    );
}

export default SyllabusViewerPage;