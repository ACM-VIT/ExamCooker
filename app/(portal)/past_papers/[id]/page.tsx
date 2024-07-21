import React from 'react';
import { PrismaClient } from '@prisma/client';
import dynamic from 'next/dynamic';
import PDFViewer from '@/app/components/pdfviewer';
import { auth } from '@/app/auth';
import { recordViewHistory } from '@/app/actions/viewHistory';
import { TimeHandler } from '@/app/components/forumpost/CommentContainer';

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

async function PdfViewerPage({ params }: { params: { id: string } }) {
    const prisma = new PrismaClient();
    let paper;
    let year: string = '';
    let slot: string = '';

    try {
        paper = await prisma.pastPaper.findUnique({
            where: { id: params.id },
            include: { author: true, tags: true },
        });

    for(let i : number = 0; i < paper!.tags.length; i++) {
        if(isValidYear(paper!.tags[i].name)) {
            year = paper!.tags[i].name
        }
        else if (isValidSlot(paper!.tags[i].name)) {
            slot = paper!.tags[i].name
        }
    }

        if (!paper) {
            throw new Error('Past Paper not found');
        }

        const session = await auth();
        const userId = session?.user?.id;

        if (userId) {
            await recordViewHistory('pastPaper', paper.id, userId);
        }
    } catch (error) {
        console.error('Error fetching past paper:', error);
        return <div className="text-center p-8">Error loading past paper. Please try again later.</div>;
    } finally {
        await prisma.$disconnect();
    }

    const postTime : string = paper.createdAt.toISOString();

    return (
        <div className="flex flex-col lg:flex-row h-screen text-black dark:text-[#D5D5D5]">
          <div className="lg:w-1/2 flex flex-col overflow-hidden">
            <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{removePdfExtension(paper.title)}</h1>
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-base sm:text-lg"><span className="font-semibold">Slot:</span> {slot}</p>
                  <p className="text-base sm:text-lg"><span className="font-semibold">Year:</span> {year}</p>
                  <p className="text-base sm:text-lg"><span className="font-semibold">Posted by: </span> {paper.author?.name || 'Unknown'}</p>
                  <p className='text-base sm:text-xs'><span className="font-semibold">Posted at: {TimeHandler(postTime).hours}:{TimeHandler(postTime).minutes}{TimeHandler(postTime).amOrPm}, {TimeHandler(postTime).day}-{TimeHandler(postTime).month}-{TimeHandler(postTime).year}</span></p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 lg:w-1/2 overflow-hidden lg:border-l lg:border-black dark:lg:border-[#D5D5D5] p-4">
            <div className="h-full overflow-auto">
              <PDFViewer fileUrl={paper.fileUrl} />
            </div>
          </div>
        </div>
      );
}

export default PdfViewerPage;
