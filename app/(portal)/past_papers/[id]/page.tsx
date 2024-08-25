import React from 'react';
import { PrismaClient } from '@prisma/client';
import PDFViewer from '@/app/components/pdfviewer';
import { auth } from '@/app/auth';
import { recordViewHistory } from '@/app/actions/viewHistory';
import { TimeHandler } from '@/app/components/forumpost/CommentContainer';
import DeleteButton from '@/app/components/DeleteButton';

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

function isYours(author: string | null, currentUser: string | null | undefined) {
  let state : boolean;
  currentUser === author ? state = true : state = false;
  return state;
}

async function PdfViewerPage({ params }: { params: { id: string } }) {
    const prisma = new PrismaClient();
    let paper;
    let year: string = '';
    let slot: string = '';
    const session = await auth();
    // const userId = session?.user?.id;
    const currentUser = session?.user?.name

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
        return <div className="text-center p-8 dark:text-[#d5d5d5]">Error loading past paper. Please head to /notes, or try again later.</div>;
    } finally {
        await prisma.$disconnect();
    }

    const postTime : string = paper.createdAt.toLocaleString("en-US", {timeZone: "Asia/Kolkata"});

    return (
        <div className="flex flex-col lg:flex-row h-screen text-black dark:text-[#D5D5D5]">
          <div className="lg:w-1/2 flex flex-col overflow-hidden">
            <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{removePdfExtension(paper.title)}</h1>
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-base sm:text-lg"><span className="font-semibold">Slot:</span> {slot}</p>
                  <p className="text-base sm:text-lg"><span className="font-semibold">Year:</span> {year}</p>
                  <p className="text-base sm:text-lg"><span className="font-semibold">Posted by: </span> {paper.author?.name?.slice(0,-10) || 'Unknown'}</p>
                  <div className="flex gap-2 items-center">
                    <p className='text-base sm:text-xs'><span className="font-semibold">Posted at: {TimeHandler(postTime).hours}:{TimeHandler(postTime).minutes}{TimeHandler(postTime).amOrPm}, {TimeHandler(postTime).day}-{TimeHandler(postTime).month}-{TimeHandler(postTime).year}</span></p>
                    {isYours(paper.author?.name, currentUser) && <DeleteButton itemID={paper.id} activeTab="pastPaper"/>}
                  </div>
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
