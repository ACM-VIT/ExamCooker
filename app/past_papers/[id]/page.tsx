// pages/note.tsx
import React from 'react';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';

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
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">PDF Viewer</h1>
      {/* back button */}
      <Link
                href={"/past_papers"}
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
            >
                Back
            </Link>
        <p>{params.id}</p>
  
        {/* the pdf link that has been fetched */}
        <p>{paper?.fileUrl}</p>
    </div>
  );
};

export default PdfViewerPage;
