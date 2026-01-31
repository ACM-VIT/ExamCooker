import React from 'react';
import {PrismaClient} from '@/src/generated/prisma';
import PDFViewerClient from '@/app/components/PDFViewerClient';
import {auth} from '@/app/auth';
import {TimeHandler} from '@/app/components/forumpost/CommentContainer';
import DeleteButton from '@/app/components/DeleteButton';
import {Metadata} from "next";
import {notFound} from "next/navigation";

import EditButton from '@/app/components/EditButton';

import ShareLink from '@/app/components/ShareLink';

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

async function PdfViewerPage({params}: {params: Promise<{ id: string }>}) {
    const prisma = new PrismaClient();
    let paper;
    let current_user = null;
    let year: string = '';
    let slot: string = '';
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const { id } = await params;

    try {
        paper = await prisma.pastPaper.findUnique({
            where: {
                id: id
            },
            include: {
                author: true,
                tags: true,
            },
        });

        if (userId) {
            current_user = await prisma.user.findUnique({
                where: {
                    id: userId,
                }
            });
        }

        if (paper && userId) {
            for (let i: number = 0; i < paper!.tags.length; i++) {
                if (isValidYear(paper!.tags[i].name)) {
                    year = paper!.tags[i].name
                } else if (isValidSlot(paper!.tags[i].name)) {
                    slot = paper!.tags[i].name
                }
            }


            await prisma.viewHistory.upsert({
                where: {
                    userId_pastPaperId: {
                        userId,
                        pastPaperId: paper.id
                    }
                },
                update: {
                    viewedAt: new Date(),
                    count: {
                        increment: 1
                    }
                },
                create: {
                    userId,
                    pastPaperId: paper.id,
                    viewedAt: new Date(),
                }
            });
        }
    } catch (error) {
        console.error('Error fetching note:', error);
        return (
            <div>
                <div className="text-center p-8 dark:text-[#d5d5d5]">Error loading paper. Please refresh, or try again
                    later.
                </div>
                {/* <div><FontAwesomeIcon icon={faArrowLeft}/>Go Back</div> */}
            </div>
        );
    } finally {
        await prisma.$disconnect();
    }

    if (!paper) return notFound();

    const postTime: string = paper.createdAt.toLocaleString("en-US", {timeZone: "Asia/Kolkata"});

    return (
        <div className="flex flex-col lg:flex-row h-screen text-black dark:text-[#D5D5D5]">
            <div className="lg:w-1/2 flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{removePdfExtension(paper.title)}</h1>
                        <div className="space-y-2 sm:space-y-3">
                            <p className="text-base sm:text-lg"><span className="font-semibold">Slot:</span> {slot}</p>
                            <p className="text-base sm:text-lg"><span className="font-semibold">Year:</span> {year}</p>
                            <p className="text-base sm:text-lg"><span
                                className="font-semibold">Posted by: </span> {paper.author?.name?.slice(0, -10) || 'Unknown'}
                            </p>
                            <div className="flex gap-2 items-center justify-between">
                                <p className='text-base sm:text-xs'><span
                                    className="font-semibold">Posted at: {TimeHandler(postTime).hours}:{TimeHandler(postTime).minutes}{TimeHandler(postTime).amOrPm}, {TimeHandler(postTime).day}-{TimeHandler(postTime).month}-{TimeHandler(postTime).year}</span>
                                </p>
                                {current_user?.role === "MODERATOR" &&
                                    <EditButton itemID={paper.id} title={paper.title} activeTab='pastPaper'/>}

                                {userId === paper.author.id &&
                                    <DeleteButton itemID={paper.id} activeTab="pastPaper"/>}
                                <ShareLink fileType='this Past Paper'/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 lg:w-1/2 overflow-hidden lg:border-l lg:border-black dark:lg:border-[#D5D5D5] p-4">
                <div className="h-full overflow-auto">
                    <PDFViewerClient fileUrl={paper.fileUrl}/>
                </div>
            </div>
        </div>
    );
}

export default PdfViewerPage;


export async function generateMetadata({params}: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const prisma = new PrismaClient();
    const { id } = await params;
    const paper = await prisma.pastPaper.findUnique({
        where: {
            id: id
        },
        include: {
            tags: true
        }
    })
    if (!paper) return {}
    return {
        title: removePdfExtension(paper.title),
        description: `View previous question papers here.`,
        openGraph: {
            images: paper.thumbNailUrl ? [{url: paper.thumbNailUrl}] : []
        },
        keywords: ['vit', 'previous year question papers', 'pdf', 'notes', 'question papers', 'exam', 'examcooker', 'acm', ...paper.tags.map(tag => tag.name)]
    }
}
