"use client";
import React from 'react';
import Link from 'next/link';
import { useBookmarks } from './BookmarksProvider';
import { useToast } from "@/components/ui/use-toast";

interface SyllabusCardProps {
    syllabus: {
        id: string;
        name: string;
    };
}

function processSyllabusName(input: string): string {
    return input
        .slice(9)
        .replace(/\.pdf$/, '')
        .replace(/_/g, ' ');
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

    const syllabusName = processSyllabusName(syllabus.name);
    const courseCode = syllabus.name.split('_')[0];

    return (
        <Link href={`/syllabus/${syllabus.id}`}>
            <div
                className="flex flex-col justify-start w-full h-full p-4 bg-[#5FC4E7] border-2 border-[#5FC4E7] dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 hover:border-b-2 hover:border-b-[#ffffff]  dark:hover:border-b-[#3BF4C7] dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] dark:hover:bg-[#ffffff]/10 transition-all duration-200 transform hover:scale-105 hover:shadow-lg">
                <h4>{syllabusName}</h4>
                <h6>{courseCode}</h6>
            </div>
        </Link>
    );
}

export default SyllabusCard;
