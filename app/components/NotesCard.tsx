"use client";

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Note } from '@prisma/client';
import Link from 'next/link';
import { useBookmarks } from './BookmarksProvider';

interface NotesCardProps {
    note: Note;
    index: number;
    openInNewTab?: boolean;
}

export function removePdfExtension(filename: string): string {
    if (filename.endsWith('.pdf')) {
        return filename.slice(0, -4);
    }
    return filename;
}

function NotesCard({ note, openInNewTab = false }: NotesCardProps) {
    const { isBookmarked, toggleBookmark } = useBookmarks();

    const isFav = isBookmarked(note.id, 'note');

    const handleToggleFav = () => {
        toggleBookmark({ id: note.id, type: 'note', title: note.title }, !isFav);
    };

    return (
        <div className={`max-w-sm w-full h-full text-black dark:text-[#D5D5D5]`}>
            <div className='hover:shadow-xl px-5 py-6 w-full text-center bg-[#5FC4E7] dark:bg-[#ffffff]/10 lg:dark:bg-[#0C1222] dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 border-2 border-[#5FC4E7] hover:border-b-[#ffffff] hover:border-b-2 dark:hover:border-b-[#3BF4C7]  dark:hover:bg-[#ffffff]/10 transition duration-200 transform hover:scale-105 max-w-96'>
                <div className="bg-[#d9d9d9] w-full h-44 overflow-hidden">
                    <img
                        src="https://topperworld.in/media/2022/11/c-sc.png"
                        alt={removePdfExtension(note.title)}
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="mb-2  w-full whitespace-nowrap overflow-hidden text-ellipsis">
                    {removePdfExtension(note.title)}
                </div>
                <div className="flex  justify-between items-center space-x-4">
                    <div></div>
                    <Link
                        href={`notes/${note.id}`}
                        className="py-1 px-2 text-sm flex items-center bg-white dark:bg-[#3F4451]"
                        {...(openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                        <span className="mr-1 flex items-center justify-center">
                            <FontAwesomeIcon icon={faEye} />
                        </span>
                        View
                    </Link>
                    <button onClick={handleToggleFav} className="transition-colors duration-200">
                        <FontAwesomeIcon icon={faHeart} color={isFav ? 'red' : 'lightgrey'} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NotesCard;
