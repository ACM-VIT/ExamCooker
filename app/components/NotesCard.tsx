"use client";

import React from 'react';
import Link from "next/link";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { useBookmarks } from './BookmarksProvider';
import {useToast} from "@/components/ui/use-toast";
import Image from "next/image";

interface NotesCardProps {
    note: {
        id: string;
        title: string;
        thumbNailUrl?: string | null;
    };
    index: number;
    openInNewTab?: boolean;
}


export function removePdfExtension(filename: string): string {
    if (filename.endsWith('.pdf')) {
        return filename.slice(0, -4);
    }
    return filename;
}

function NotesCard({ note, index }: NotesCardProps) {
    const { isBookmarked, toggleBookmark } = useBookmarks();
    const isFav = isBookmarked(note.id, 'note');
    const { toast } = useToast();

    const handleToggleFav = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        toggleBookmark({ id: note.id, type: 'note', title: note.title }, !isFav).catch(()=> toast({title: "Error! Could not add to favorites", variant: "destructive"}) );
    };

    return (

 <div className={`max-w-sm w-full h-full text-black dark:text-[#D5D5D5]`}>
    <Link
        href={`/notes/${note.id}`}
        prefetch={index < 3}
        className="block hover:shadow-xl px-5 py-6 w-full text-center bg-[#5FC4E7] dark:bg-[#ffffff]/10 lg:dark:bg-[#0C1222] dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 border-2 border-[#5FC4E7] hover:border-b-[#ffffff] hover:border-b-2 dark:hover:border-b-[#3BF4C7]  dark:hover:bg-[#ffffff]/10 transition duration-200 transform hover:scale-105 max-w-96 cursor-pointer"
    >
        <div className="bg-[#d9d9d9] w-full h-44 relative overflow-hidden">
                    <Image
                        src={note.thumbNailUrl || "/assets/ExamCooker.png"}
                        alt={removePdfExtension(note.title)}
                        fill
                        sizes="(min-width: 1024px) 320px, (min-width: 768px) 45vw, 90vw"
                        className="object-cover"
                        priority={index < 3}
                    />
                </div>
                <div className="flex justify-between items-center">
                    <div></div>
                    <div className="mb-2 w-full whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                        {removePdfExtension(note.title)}
                    </div>
                    <button onClick={handleToggleFav} className="transition-colors duration-200">
                        <FontAwesomeIcon icon={faHeart} color={isFav ? 'red' : 'lightgrey'} />
                    </button>
                </div>
            </Link>
        </div>
    );
}

export default NotesCard;
