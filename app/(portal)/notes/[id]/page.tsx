import React from 'react';
import { PrismaClient } from '@prisma/client';
import dynamic from 'next/dynamic';
import PDFViewer from '@/app/components/pdfviewer';
import { recordViewHistory } from '@/app/actions/viewHistory';
import { auth } from '@/app/auth';

function removePdfExtension(filename: string): string {
  return filename.endsWith('.pdf') ? filename.slice(0, -4) : filename;
}

async function PdfViewerPage({ params }: { params: { id: string } }) {
  const prisma = new PrismaClient();
  let note;

  try {
    note = await prisma.note.findUnique({
      where: { id: params.id },
      include: { author: true },
    });

    if (!note) {
      throw new Error('Note not found');
    }
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      await recordViewHistory('note', note.id, userId);
    }
  } catch (error) {
    console.error('Error fetching note:', error);
    return <div className="text-center p-8">Error loading note. Please try again later.</div>;
  } finally {
    await prisma.$disconnect();
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="lg:w-1/2 p-8 flex flex-col justify-center overflow-none">
        <h1 className="text-3xl font-bold mb-4 truncate">{removePdfExtension(note.title)}</h1>
        <div className="space-y-2 overflow-y-auto">
          <p className="text-lg"><span className="font-semibold">Slot:</span> A1</p>
          <p className="text-lg"><span className="font-semibold">Year:</span> 2024</p>
          <p className="text-lg"><span className="font-semibold">Author:</span> {note.author?.name || 'Unknown'}</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 lg:border-l lg:border-black-900 lg:dark:border-[#d5d5d5] lg:overflow-hidden p-4">
        <div className="h-full">
          <PDFViewer fileUrl={note.fileUrl} />
        </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(PdfViewerPage), { ssr: false });