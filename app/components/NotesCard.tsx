"use client";

import React from 'react';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faCaretDown, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Note } from '@prisma/client';
import Link from 'next/link';

interface NotesCardProps {
  note: Note;
}

function NotesCard({ note }: NotesCardProps) {
  const [isFav, setIsFav] = useState(false);

  function FavpeCLick() {
    setIsFav(!isFav);
  }

  return (
    <div className="max-w-sm w-full">
      <div className="p-4 w-full text-center bg-[#5fc4e7]">
        <div className="bg-[#d9d9d9] w-full h-36 mb-4 overflow-hidden">
          <img src="https://topperworld.in/media/2022/11/c-sc.png" alt={note.title} className="w-full h-full object-cover" />
        </div>
        <div className="mb-2 text-black w-full whitespace-nowrap overflow-hidden text-ellipsis">
          {note.title}
        </div>
        <div className="flex justify-around items-center space-x-4">
          <Link href={`notes/${note.id}`} className="py-[2.605%] px-2 text-sm flex items-center bg-white text-black">
            <span className="mr-1 flex items-center justify-center">
              <FontAwesomeIcon icon={faEye} />
            </span>
            View Paper
          </Link>
          <button className="py-[2.605%] px-2 text-sm flex items-center bg-white text-black">
            More
            <span className="ml-2 flex items-center justify-center">
              <FontAwesomeIcon icon={faCaretDown} style={{ fontSize: '1.25rem' }} />
            </span>
          </button>
          <button onClick={FavpeCLick} style={{ color: isFav ? 'red' : 'lightgrey' }}>
            <FontAwesomeIcon icon={faHeart} />
          </button>
        </div>
      </div>
    </div>
  )
};

export default NotesCard;
