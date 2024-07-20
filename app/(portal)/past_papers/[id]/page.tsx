import React from 'react';
import { PrismaClient } from '@prisma/client';
import dynamic from 'next/dynamic';
import PDFViewer from '@/app/components/pdfviewer';
import { auth } from '@/app/auth';
import { recordViewHistory } from '@/app/actions/viewHistory';

function removePdfExtension(filename: string): string {
    return filename.endsWith('.pdf') ? filename.slice(0, -4) : filename;
}

async function PdfViewerPage({ params }: { params: { id: string } }) {
    const prisma = new PrismaClient();
    let pastPaper;

    try {
        pastPaper = await prisma.pastPaper.findUnique({
            where: { id: params.id },
            include: { author: true },
        });

        if (!pastPaper) {
            throw new Error('Past Paper not found');
        }

        const session = await auth();
        const userId = session?.user?.id;

        if (userId) {
            await recordViewHistory('pastPaper', pastPaper.id, userId);
        }
    } catch (error) {
        console.error('Error fetching past paper:', error);
        return <div className="text-center p-8">Error loading past paper. Please try again later.</div>;
    } finally {
        await prisma.$disconnect();
    }

    return (
        <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="lg:w-1/2 p-8 flex flex-col justify-center overflow-none">
                <h1 className="text-3xl font-bold mb-4 truncate">{removePdfExtension(pastPaper.title)}</h1>
                <div className="space-y-2 overflow-y-auto">
                    <p className="text-lg"><span className="font-semibold">Slot:</span> A1</p>
                    <p className="text-lg"><span className="font-semibold">Year:</span> 2024</p>
                    <p className="text-lg"><span className="font-semibold">Author:</span> {pastPaper.author?.name || 'Unknown'}</p>
                </div>
            </div>
            <div className="w-full lg:w-1/2 lg:border-l lg:border-black-900 lg:dark:border-[#d5d5d5] lg:overflow-hidden p-4">
                <div className="h-full">
                    <PDFViewer fileUrl={pastPaper.fileUrl} />
                </div>
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve(PdfViewerPage), { ssr: false });
