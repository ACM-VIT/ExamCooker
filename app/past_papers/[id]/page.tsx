// pages/note.tsx
import React from 'react';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import PdfViewer from '@/app/components/pdfviewer';

async function PdfViewerPage({params}: {params : {id : string}}) {
  
  const prisma = new PrismaClient();
  const paper = await prisma.pastPaper.findUnique({
    where : {
      id : params.id,
    },
    include: {
      author: true,
    },
  });

return (
        <div className="container mx-auto bg-[#C2E6EC] min-h-screen">
            <div className="h-[10vh] w-full bg-[#C2E6EC] text-black text-center flex items-center justify-center">
                header
            </div>
            <div className="grid grid-cols-4 lg:grid-cols-8 h-[90vh] gap-4">
                <div className="col-span-4 lg:col-span-4 flex flex-col items-center justify-center mx-auto text-black pt-10">
                    <h1 className="text-center">{paper?.title}</h1><br />
                    <h2>Slot: Slot </h2><br />
                    <h2>Year: Year</h2><br />
                </div>
                <div className="hidden lg:block w-[85vh] h-0 transform rotate-[90.13deg] origin-top-left border border-black opacity-80"></div>
                <div className="col-span-4 lg:col-span-3 flex items-center justify-center">
                  {/* <p>{paper?.fileUrl}</p> */}
                    <PdfViewer fileUrl={paper?.fileUrl} />
                </div>
            </div>
        </div>
    );
  }
    export default PdfViewerPage;