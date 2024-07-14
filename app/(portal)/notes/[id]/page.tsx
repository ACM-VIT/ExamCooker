// pages/note.tsx
import React from 'react';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import PDFViewer from '@/app/components/pdfviewer';

function removePdfExtension(filename: string): string {
  if (filename.endsWith('.pdf')) {
      return filename.slice(0, -4);
  }
  return filename;
}

async function PdfViewerPage({params }: {params : {id : string}}) {
  
  const prisma = new PrismaClient();
  const note = await prisma.note.findUnique({
    where : {
      id : params.id,
    },
    include: {
      author: true,
    },
  });


return (
      <div className="transition-colors p-6 flex flex-col items-center space-x-4 lg:flex-row h-screen text-black dark:text-[#D5D5D5] divide-black dark:divide-[#D5D5D5] divide-x">
          <div className="h-full w-1/2 pr-6">
              <h1>{removePdfExtension(note!.title)}</h1>
              <h2>Slot: A1</h2>
              <h2>Year: 2024</h2>
          </div>
          <div className='pl-6 w-1/2 h-full'>
              <div className="h-full w-full overflow-hidden">
                  <PDFViewer fileUrl={note!.fileUrl} />
              </div>
          </div>
      </div>
);
}
export default dynamic(() => Promise.resolve(PdfViewerPage), { ssr: false });
