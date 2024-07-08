
"use client";
import React from 'react';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Note } from '@prisma/client';
import Link from 'next/link';

interface NotesCardProps {
    note: Note;
    index: number;
}

const colors = ['#5FC4E7', '#82BEE9'];

function removePdfExtension(filename: string): string {
    if (filename.endsWith('.pdf')) {
        return filename.slice(0, -4);
    }
    return filename;
}

function NotesCard({ note, index }: NotesCardProps) {
    const [isFav, setIsFav] = useState(false);

    function toggleFav() {
        setIsFav(!isFav);
    }

    return (
        <div className={`text-black dark:text-[#D5D5D5] dark:border-b-2 bg-[#5FC4E7] dark:lg:bg-none dark:bg-[#0C1222] lg:bg-none hover:border-b-[#ffffff] hover:border-b-2 dark:hover:border-b-[#3BF4C7] dark:border-b-[#ffffff]/20 dark:hover:bg-[#ffffff]/10 transition duration-200 transform hover:scale-105 px-5 py-6 w-full max-w-96 text-center dark:bg-[#ffffff]/1`}>
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
                <Link href={`notes/${note.id}`} className="py-1 px-2 text-sm flex items-center bg-white dark:bg-[#3F4451]">
                    <span className="mr-1 flex items-center justify-center">
                        <FontAwesomeIcon icon={faEye} />
                    </span>
                    View
                </Link>

                <button onClick={toggleFav} style={{ color: isFav ? 'red' : 'lightgrey' }}>
                    <FontAwesomeIcon icon={faHeart} />
                </button>

            </div>
        </div>

    );

}

export default NotesCard;



