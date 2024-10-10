"use client";
import React from 'react';
import Link from 'next/link';
import { syllabi } from '@prisma/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { useBookmarks } from './BookmarksProvider';
import { useToast } from "@/components/ui/use-toast";

interface SyllabusCardProps {
    syllabus: syllabi;
}

function SyllabusCard({ syllabus }: SyllabusCardProps) {
    const { isBookmarked, toggleBookmark } = useBookmarks();
    const isFav = isBookmarked(syllabus.id, 'subject');
    const { toast } = useToast();

    const handleToggleFav = () => {
        toggleBookmark({
            id: syllabus.id,
            type: 'subject',
            title: syllabus.name
        }, !isFav).catch(() => toast({ title: "Error! Could not add to favorites", variant: "destructive" }));
    };

    return (
        <div
            className="flex flex-col justify-between w-full h-18 p-4 bg-[#5FC4E7] border-2 border-[#5FC4E7] dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 hover:border-b-2 hover:border-b-[#ffffff]  dark:hover:border-b-[#3BF4C7] dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] dark:hover:bg-[#ffffff]/10 transition-all duration-200 transform hover:scale-105 hover:shadow-lg">
            <div className="items-start">
                <Link href={`/syllabus/${syllabus.id}`}
                    className="block text-left"
                    style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%' 
                    }}>
                    {syllabus.name}
                </Link>
            </div>
            <div className="items-end">
                <div className="flex justify-between">
                    <div />
                    <button onClick={handleToggleFav} className="ml-4" style={{ color: isFav ? 'red' : 'lightgrey' }}>
                        <FontAwesomeIcon icon={faHeart} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SyllabusCard;
