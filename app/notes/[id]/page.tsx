// pages/note.tsx
import React from 'react';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import PDFViewer from '@/app/components/pdfviewer';

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
  <div className="container mx-auto">
      <div className="flex flex-col lg:flex-row h-[90vh]">
          <div className="w-full lg:w-1/2 flex flex-col items-center justify-center mx-auto text-black p-10">
              <h1 className="text-center">{note?.title}</h1><br />
              <h2>Slot: A1</h2><br />
              <h2>Year: 2024</h2><br />
          </div>
          <div className='flex flex-col w-full lg:w-1/2 items-center justify-center'>
              <div className="h-[90vh] w-full pt-4 flex items-center justify-center lg:pl-24">
                  <PDFViewer fileUrl={note?.fileUrl} />
              </div>
          </div>
      </div>
  </div>
);
}
export default dynamic(() => Promise.resolve(PdfViewerPage), { ssr: false });
